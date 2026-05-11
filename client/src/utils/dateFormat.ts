const MONTHS_RU_FULL = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

/**
 * Pure string parsing of an ISO date — avoids `new Date(s)`, which on some
 * iOS Safari / WKWebView versions interprets a date-only "YYYY-MM-DD" as
 * LOCAL midnight, which then shifts a day when read back via
 * getUTCDate(). All formatters below use this so display is timezone-safe.
 */
const parseISODate = (iso: string): { y: number; m: number; d: number } | null => {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
};

export const formatBirthCard = (p: { birthDate: string | null; birthYear: number | null; birthDateKnown: boolean }): string => {
  if (p.birthDateKnown && p.birthDate) {
    const parsed = parseISODate(p.birthDate);
    if (parsed) return String(parsed.y);
  }
  if (p.birthYear) return p.birthYear.toString();
  return '–';
};

export const formatBirthFull = (p: { birthDate: string | null; birthYear: number | null; birthDateKnown: boolean }): string => {
  if (p.birthDateKnown && p.birthDate) {
    const parsed = parseISODate(p.birthDate);
    if (parsed) return `${parsed.d} ${MONTHS_RU_FULL[parsed.m - 1]} ${parsed.y}`;
  }
  if (p.birthYear) return `${p.birthYear} г.`;
  return '–';
};

export const formatDeathCard = (p: { deathDate: string | null; deathYear: number | null; deathDateKnown: boolean; isAlive: boolean }): string => {
  if (p.isAlive) return '';
  if (p.deathDateKnown && p.deathDate) {
    const parsed = parseISODate(p.deathDate);
    if (parsed) return String(parsed.y);
  }
  if (p.deathYear) return p.deathYear.toString();
  return '–';
};

export const formatDeathFull = (p: { deathDate: string | null; deathYear: number | null; deathDateKnown: boolean; isAlive: boolean }): string => {
  if (p.isAlive) return '';
  if (p.deathDateKnown && p.deathDate) {
    const parsed = parseISODate(p.deathDate);
    if (parsed) return `${parsed.d} ${MONTHS_RU_FULL[parsed.m - 1]} ${parsed.y}`;
  }
  if (p.deathYear) return `${p.deathYear} г.`;
  return '–';
};

export const formatLifespan = (p: { birthYear: number | null; birthDate: string | null; birthDateKnown: boolean; isAlive: boolean; deathYear: number | null; deathDate: string | null; deathDateKnown: boolean }): string => {
  const b = formatBirthCard(p);
  if (p.isAlive) return b;
  return `${b} – ${formatDeathCard(p)}`;
};

// Re-export for any consumer that might still import this.
export { MONTHS_RU_FULL };
