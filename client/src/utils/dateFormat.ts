const MONTHS_RU_FULL = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

export const formatBirthCard = (p: { birthDate: string | null; birthYear: number | null; birthDateKnown: boolean }): string => {
  if (p.birthDateKnown && p.birthDate) return new Date(p.birthDate).getUTCFullYear().toString();
  if (p.birthYear) return p.birthYear.toString();
  return '–';
};

export const formatBirthFull = (p: { birthDate: string | null; birthYear: number | null; birthDateKnown: boolean }): string => {
  if (p.birthDateKnown && p.birthDate) {
    const d = new Date(p.birthDate);
    return `${d.getUTCDate()} ${MONTHS_RU_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  if (p.birthYear) return `${p.birthYear} г.`;
  return '–';
};

export const formatDeathCard = (p: { deathDate: string | null; deathYear: number | null; deathDateKnown: boolean; isAlive: boolean }): string => {
  if (p.isAlive) return '';
  if (p.deathDateKnown && p.deathDate) return new Date(p.deathDate).getUTCFullYear().toString();
  if (p.deathYear) return p.deathYear.toString();
  return '–';
};

export const formatDeathFull = (p: { deathDate: string | null; deathYear: number | null; deathDateKnown: boolean; isAlive: boolean }): string => {
  if (p.isAlive) return '';
  if (p.deathDateKnown && p.deathDate) {
    const d = new Date(p.deathDate);
    return `${d.getUTCDate()} ${MONTHS_RU_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  if (p.deathYear) return `${p.deathYear} г.`;
  return '–';
};

export const formatLifespan = (p: { birthYear: number | null; birthDate: string | null; birthDateKnown: boolean; isAlive: boolean; deathYear: number | null; deathDate: string | null; deathDateKnown: boolean }): string => {
  const b = formatBirthCard(p);
  if (p.isAlive) return b;
  return `${b} – ${formatDeathCard(p)}`;
};
