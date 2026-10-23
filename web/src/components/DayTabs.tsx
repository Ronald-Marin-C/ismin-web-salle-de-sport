import { formatDay } from '../format';

interface DayTabsProps {
  dates: string[];
  selected: string | undefined;
  onSelect: (date: string) => void;
}

export const DayTabs = ({ dates, selected, onSelect }: DayTabsProps) => {
  return (
    <div className="day-tabs" role="group" aria-label="Jour">
      {dates.map((date) => (
        <button
          key={date}
          className="day-tab"
          type="button"
          aria-pressed={date === selected}
          onClick={() => onSelect(date)}
        >
          {formatDay(date)}
        </button>
      ))}
    </div>
  );
};
