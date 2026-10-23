import { Injectable } from '@nestjs/common';
import type { Registration as RegistrationRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hasStarted, isSlotInWindow, MAX_SLOTS_PER_DAY, SLOT_CAPACITY, slotStart } from '../slots/slot-rules.js';
import {
  AlreadyRegistered,
  DailyLimitReached,
  InitiationRequired,
  SlotNotBookable,
  type Registration,
  type RegistrationStatus,
} from './registration.js';

/** Booking the slots: the places, the waiting lists and the rules a booking must follow. */
@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

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
