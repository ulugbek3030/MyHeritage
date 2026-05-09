import { useEffect, useRef } from 'react';

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5; // odd; the middle row is the selected value
const PAD_ITEMS = (VISIBLE_ITEMS - 1) / 2;
const TOTAL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const daysInMonth = (year: number, month: number) => {
  // month: 1..12
  return new Date(year, month, 0).getDate();
};

interface ColumnProps {
  items: string[];
  selectedIndex: number;
  onChange: (i: number) => void;
  ariaLabel: string;
}

const Column = ({ items, selectedIndex, onChange, ariaLabel }: ColumnProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);

  // Snap external value changes / mount → scroll to selected item.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTop = selectedIndex * ITEM_HEIGHT;
    // Allow next user scroll events through.
    const id = setTimeout(() => { programmatic.current = false; }, 50);
    return () => clearTimeout(id);
  }, [selectedIndex]);

  const onScroll = () => {
    if (programmatic.current) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      // Snap precisely to the row.
      if (Math.abs(el.scrollTop - clamped * ITEM_HEIGHT) > 0.5) {
        programmatic.current = true;
        el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
        setTimeout(() => { programmatic.current = false; }, 200);
      }
      if (clamped !== selectedIndex) onChange(clamped);
    }, 110);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={onScroll}
      className="wheel-col"
      style={{
        flex: 1,
        height: TOTAL_HEIGHT,
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        // hide scrollbar
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch' as const,
      }}
    >
      <div style={{ height: PAD_ITEMS * ITEM_HEIGHT }} />
      {items.map((label, i) => (
        <div
          key={i}
          style={{
            height: ITEM_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 19,
            fontWeight: i === selectedIndex ? 800 : 500,
            color: i === selectedIndex ? 'var(--text)' : 'var(--text-muted)',
            opacity: i === selectedIndex ? 1 : Math.max(0.3, 1 - Math.abs(i - selectedIndex) * 0.25),
            scrollSnapAlign: 'center',
            transition: 'color 0.12s, font-weight 0.12s',
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          {label}
        </div>
      ))}
      <div style={{ height: PAD_ITEMS * ITEM_HEIGHT }} />
    </div>
  );
};

interface Props {
  /** ISO date string YYYY-MM-DD or empty */
  value: string;
  onChange: (iso: string) => void;
  minYear?: number;
  maxYear?: number;
}

export const DateWheelPicker = ({ value, onChange, minYear = 1900, maxYear = new Date().getFullYear() }: Props) => {
  const today = new Date();
  // Server may serialise PG DATE as a full ISO timestamp
  // ("1987-05-18T00:00:00.000Z"). Take only the YYYY-MM-DD prefix so split
  // doesn't produce a junky dStr like "18T00:00:00.000Z".
  const safe = value ? value.slice(0, 10) : '';
  const [yStr, mStr, dStr] = safe ? safe.split('-') : [];
  const year = yStr ? Number(yStr) : today.getFullYear();
  const month = mStr ? Number(mStr) : today.getMonth() + 1;
  const day = dStr ? Number(dStr) : today.getDate();

  const years: string[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(String(y));
  const yearIndex = years.indexOf(String(year));

  const monthLabels = MONTHS_RU;
  const monthIndex = month - 1;

  const dayCount = daysInMonth(year, month);
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));
  const dayIndex = Math.min(day - 1, dayCount - 1);

  const emit = (d: number, m: number, y: number) => {
    const days = daysInMonth(y, m);
    const dd = Math.min(d, days);
    onChange(`${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        gap: 4,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        marginBottom: 14,
      }}
    >
      <Column
        ariaLabel="День"
        items={days}
        selectedIndex={dayIndex}
        onChange={(i) => emit(i + 1, month, year)}
      />
      <Column
        ariaLabel="Месяц"
        items={monthLabels}
        selectedIndex={monthIndex}
        onChange={(i) => emit(day, i + 1, year)}
      />
      <Column
        ariaLabel="Год"
        items={years}
        selectedIndex={yearIndex >= 0 ? yearIndex : 0}
        onChange={(i) => emit(day, month, Number(years[i]))}
      />
      {/* Centre selection indicator (top + bottom hairlines) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: 8 + PAD_ITEMS * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
          borderTop: '1px solid rgba(251,191,36,0.4)',
          borderBottom: '1px solid rgba(251,191,36,0.4)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
