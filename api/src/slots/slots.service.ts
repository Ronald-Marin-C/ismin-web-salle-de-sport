import { Injectable } from '@nestjs/common';
import type { Registration } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegistrationStatus } from '../registrations/registration.js';
import type { SlotView } from './slot.js';
import { CLOSING_HOUR, hasStarted, OPENING_HOUR, SLOT_CAPACITY, slotStart, visibleDates } from './slot-rules.js';

/** Builds the planning from the registrations; the slots themselves are not stored. */
@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The slots of the visible days, as one user sees them.
   *
   * @param userId The connected user, whose own registrations are marked.
   * @param now Decides the visible days and the slots that have started.
   * @returns 15 slots a day for {@link visibleDates}, by date then hour.
   */
  async listForUser(userId: string, now: Date): Promise<SlotView[]> {
    const dates = visibleDates(now);
    // One query for the whole week, grouped in memory: one query per slot would make 105.
    const registrations = await this.prisma.registration.findMany({
      where: { date: { in: dates } },
      orderBy: { createdAt: 'asc' },
    });

    const bySlot = new Map<string, Registration[]>();
    for (const registration of registrations) {
      const key = slotKey(registration.date, registration.hour);
      bySlot.set(key, [...(bySlot.get(key) ?? []), registration]);
    }

    return dates.flatMap((date) =>
      Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, i) => {
        const hour = OPENING_HOUR + i;
        return toSlotView(date, hour, bySlot.get(slotKey(date, hour)) ?? [], userId, now);
      }),
    );
  }
}

function slotKey(date: string, hour: number): string {
  return `${date} ${hour}`;
}

/** @param registrations The slot's registrations, oldest first. */
function toSlotView(date: string, hour: number, registrations: Registration[], userId: string, now: Date): SlotView {
  const confirmed = registrations.filter((registration) => registration.status === 'confirmed');
  const waiting = registrations.filter((registration) => registration.status === 'waiting');
  const view: SlotView = {
    date,
    hour,
    startsAt: slotStart(date, hour).toISOString(),
    remaining: SLOT_CAPACITY - confirmed.length,
    waitingCount: waiting.length,
    isPast: hasStarted(date, hour, now),
  };

  const mine = registrations.find((registration) => registration.userId === userId);
  if (mine) {
    view.myStatus = mine.status as RegistrationStatus;
    view.myRegistrationId = mine.id;
    if (mine.status === 'waiting') view.myPosition = waiting.indexOf(mine) + 1;
  }
  return view;
}
