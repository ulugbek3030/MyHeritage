import type { EventType, FamilyEvent } from '../types';

/**
 * Single source of truth for event icons. Used by the calendar (month grid +
 * events list) and by the tree (per-person badges for the current month).
 * Birthdays and memorials all use the same gift icon — it kept getting hard
 * to read four distinct emoji at the small sizes we render at.
 */
export const eventIcon = (type: EventType): string => {
  switch (type) {
    case 'birthday': return '🎁';
    case 'child_birthday': return '🎁';
    case 'anniversary': return '💍';
    case 'memorial': return '🎁';
  }
};

/** Distinct icons for a list of events, preserving first-seen order. */
export const distinctEventIcons = (events: FamilyEvent[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of events) {
    const i = eventIcon(e.type);
    if (!seen.has(i)) { seen.add(i); out.push(i); }
  }
  return out;
};
