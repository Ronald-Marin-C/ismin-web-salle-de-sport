import { formatHour, formatStatus } from '../format';
import type { SlotView } from '../types';

interface SlotRowProps {
  slot: SlotView;
  /** False until the initiation is validated. */
  canBook: boolean;
  onBook: () => void;
}

export const SlotRow = ({ slot, canBook, onBook }: SlotRowProps) => {
  const isFull = slot.remaining <= 0;

  return (
    <div className="slot">
      <span className="slot-hours">{formatHour(slot.hour)}</span>
      <span className="slot-places">
        {isFull
          ? `Complet · ${slot.waitingCount} en attente`
          : `${slot.remaining} ${slot.remaining === 1 ? 'place restante' : 'places restantes'}`}
      </span>
      {slot.myStatus && <span className="badge">{formatStatus(slot.myStatus, slot.myPosition)}</span>}
      <button
        className="button"
        type="button"
        disabled={!canBook || slot.isPast || slot.myStatus !== undefined}
        onClick={onBook}
      >
        {isFull ? "Rejoindre la liste d'attente" : "S'inscrire"}
      </button>
    </div>
  );
};
