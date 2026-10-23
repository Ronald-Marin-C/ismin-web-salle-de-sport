import { Injectable } from '@nestjs/common';
import type { Registration as RegistrationRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SlotView } from '../slots/slot.js';
import {
  CANCEL_DEADLINE_MINUTES,
  hasStarted,
  isSlotInWindow,
  MAX_SLOTS_PER_DAY,
  minutesBefore,
  SLOT_CAPACITY,
  slotStart,
} from '../slots/slot-rules.js';
import { SlotsService } from '../slots/slots.service.js';
import {
  AlreadyRegistered,
  CancellationTooLate,
  DailyLimitReached,
  InitiationRequired,
  NotYourRegistration,
  RegistrationNotFound,
  SlotNotBookable,
  type Registration,
  type RegistrationStatus,
} from './registration.js';

/** Booking and cancelling the slots: the places, the waiting lists and the rules they follow. */
@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: SlotsService,
  ) {}

  /**
   * Books a slot for a user: a place while there is room, then a place in the waiting list.
   *
   * The checks and the insert run in one transaction, so that two users
   * cannot both take the last place.
   *
   * @param date `YYYY-MM-DD`.
   * @param hour From 7 to 21.
   * @param now Decides which slots can still be booked.
   * @returns The registration, with its place in the waiting list when the slot is full.
   * @throws InitiationRequired when no referent has validated the user's initiation.
   * @throws SlotNotBookable when the slot has started, or is not on the planning.
   * @throws AlreadyRegistered when the user already holds this slot, waiting list included.
   * @throws DailyLimitReached when the user already holds two slots that day.
   */
  register(userId: string, date: string, hour: number, now: Date): Promise<Registration> {
    return this.prisma.$transaction(async (tx) => {
      // Read from the database rather than the token: the initiation may be validated after the login.
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user?.initiationValidatedAt) throw new InitiationRequired();
      if (!isSlotInWindow(date, hour, now) || hasStarted(date, hour, now)) throw new SlotNotBookable();

      const sameDay = await tx.registration.findMany({ where: { userId, date } });
      if (sameDay.some((registration) => registration.hour === hour)) throw new AlreadyRegistered();
      if (sameDay.length >= MAX_SLOTS_PER_DAY) throw new DailyLimitReached();

      const confirmed = await tx.registration.count({ where: { date, hour, status: 'confirmed' } });
      if (confirmed < SLOT_CAPACITY) {
        return toRegistration(await tx.registration.create({ data: { userId, date, hour, status: 'confirmed' } }));
      }

      // Everyone already waiting registered earlier: the newcomer joins the end of the line.
      const ahead = await tx.registration.count({ where: { date, hour, status: 'waiting' } });
      const row = await tx.registration.create({ data: { userId, date, hour, status: 'waiting' } });
      return toRegistration(row, ahead + 1);
    });
  }

  /**
   * Cancels one of the user's registrations. When it held a place, the place
   * goes to the first in the slot's waiting list.
   *
   * The cancellation and the promotion run in one transaction: if the
   * promotion fails, the cancellation is undone, so that a place never stays
   * free while someone is waiting for it.
   *
   * @param now Decides whether it is still time to cancel.
   * @throws RegistrationNotFound when no registration has this id.
   * @throws NotYourRegistration when the registration belongs to another user.
   * @throws CancellationTooLate less than an hour before the slot, waiting list included.
   */
  cancel(userId: string, registrationId: string, now: Date): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const registration = await tx.registration.findUnique({ where: { id: registrationId } });
      if (!registration) throw new RegistrationNotFound();
      if (registration.userId !== userId) throw new NotYourRegistration();
      const { date, hour } = registration;
      if (minutesBefore(date, hour, now) < CANCEL_DEADLINE_MINUTES) throw new CancellationTooLate();

      await tx.registration.delete({ where: { id: registrationId } });
      if (registration.status !== 'confirmed') return;

      // Same order as the planning: the place goes to the one it shows first in line.
      const next = await tx.registration.findFirst({
        where: { date, hour, status: 'waiting' },
        orderBy: { createdAt: 'asc' },
      });
      if (next) await tx.registration.update({ where: { id: next.id }, data: { status: 'confirmed' } });
    });
  }

  /**
   * The user's registrations whose slot is not over, by date then hour.
   *
   * Read from the planning, so that the places in the waiting lists are the
   * ones `GET /slots` shows.
   *
   * @param now Decides the visible days and the slots that are over.
   */
  async findMine(userId: string, now: Date): Promise<Registration[]> {
    const slots = await this.slots.listForUser(userId, now);
    // A slot is over once the next hour has begun.
    return slots
      .filter((slot) => !hasStarted(slot.date, slot.hour + 1, now))
      .flatMap((slot) => fromSlot(slot) ?? []);
  }
}

/** The user's registration in a slot of their planning, when they hold one. */
function fromSlot(slot: SlotView): Registration | undefined {
  if (!slot.myRegistrationId || !slot.myStatus) return undefined;
  const registration: Registration = {
    id: slot.myRegistrationId,
    date: slot.date,
    hour: slot.hour,
    status: slot.myStatus,
    startsAt: slot.startsAt,
  };
  if (slot.myPosition) registration.position = slot.myPosition;
  return registration;
}

/** @param position The place in the waiting list, for a `waiting` registration. */
function toRegistration(row: RegistrationRow, position?: number): Registration {
  const registration: Registration = {
    id: row.id,
    date: row.date,
    hour: row.hour,
    status: row.status as RegistrationStatus,
    startsAt: slotStart(row.date, row.hour).toISOString(),
  };
  if (position) registration.position = position;
  return registration;
}
