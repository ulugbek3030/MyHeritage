import { query } from '../db/pool.js';

export type EventType = 'birthday' | 'memorial' | 'anniversary' | 'child_birthday';
export interface Event {
  type: EventType;
  date: string;       // YYYY-MM-DD next occurrence (or original if exact-day disabled)
  daysUntil: number;
  personId?: string;
  personIds?: [string, string];
  meta: { name: string; relation?: string; ageOnEvent?: number; yearsAgo?: number };
}

const yearOnly = (year: number, monthDay: string) => `${year}-${monthDay}`;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const computeEvents = async (treeId: string, from: Date, to: Date): Promise<Event[]> => {
  const persons = (await query<any>(`SELECT * FROM persons WHERE tree_id = $1`, [treeId])).rows;
  const couples = (await query<any>(`SELECT * FROM relationships WHERE tree_id = $1 AND category='couple' AND start_date IS NOT NULL`, [treeId])).rows;

  const out: Event[] = [];
  const yearStart = from.getUTCFullYear();
  const yearEnd = to.getUTCFullYear();

  for (const p of persons) {
    if (p.birth_date) {
      const md = ymd(new Date(p.birth_date)).slice(5);
      for (let y = yearStart; y <= yearEnd; y++) {
        const dStr = yearOnly(y, md);
        const d = new Date(dStr + 'T00:00:00Z');
        if (d < from || d > to) continue;
        const ageOnEvent = y - new Date(p.birth_date).getUTCFullYear();
        const isChild = ageOnEvent < 14;
        out.push({
          type: !p.is_alive ? 'memorial' : (isChild ? 'child_birthday' : 'birthday'),
          date: dStr,
          daysUntil: Math.floor((d.getTime() - from.getTime()) / 86400000),
          personId: p.id,
          meta: { name: `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}`, ageOnEvent },
        });
      }
    }
    if (!p.is_alive && p.death_date) {
      const md = ymd(new Date(p.death_date)).slice(5);
      const deathYear = new Date(p.death_date).getUTCFullYear();
      for (let y = yearStart; y <= yearEnd; y++) {
        if (y === deathYear) continue;
        const dStr = yearOnly(y, md);
        const d = new Date(dStr + 'T00:00:00Z');
        if (d < from || d > to) continue;
        out.push({
          type: 'memorial',
          date: dStr,
          daysUntil: Math.floor((d.getTime() - from.getTime()) / 86400000),
          personId: p.id,
          meta: { name: `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}`, yearsAgo: y - deathYear },
        });
      }
    }
  }

  for (const c of couples) {
    if (!c.start_date) continue;
    const md = ymd(new Date(c.start_date)).slice(5);
    const startY = new Date(c.start_date).getUTCFullYear();
    const p1 = persons.find((x) => x.id === c.person1_id);
    const p2 = persons.find((x) => x.id === c.person2_id);
    if (!p1 || !p2) continue;
    for (let y = yearStart; y <= yearEnd; y++) {
      if (y <= startY) continue;
      const dStr = yearOnly(y, md);
      const d = new Date(dStr + 'T00:00:00Z');
      if (d < from || d > to) continue;
      out.push({
        type: 'anniversary',
        date: dStr,
        daysUntil: Math.floor((d.getTime() - from.getTime()) / 86400000),
        personIds: [p1.id, p2.id],
        meta: { name: `${p1.first_name} + ${p2.first_name}`, yearsAgo: y - startY },
      });
    }
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
};
