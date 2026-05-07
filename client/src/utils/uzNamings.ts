export const generateMiddleName = (fatherFirstName: string | null, gender: 'male' | 'female'): string => {
  if (!fatherFirstName) return '';
  const suffix = gender === 'male' ? "o'g'li" : 'qizi';
  return `${fatherFirstName} ${suffix}`;
};

export type RelationKey = 'father' | 'mother' | 'son' | 'daughter' | 'brother' | 'sister' | 'husband' | 'wife' | 'amaki' | 'amma' | 'togha' | 'kelin' | 'kuyov';

export const RELATIONS_RU: Record<RelationKey, string> = {
  father: 'отец', mother: 'мать', son: 'сын', daughter: 'дочь', brother: 'брат', sister: 'сестра',
  husband: 'муж', wife: 'жена', amaki: 'дядя по отцу', amma: 'тётя по отцу', togha: 'дядя по матери',
  kelin: 'невестка', kuyov: 'зять',
};

export const RELATIONS_UZ: Record<RelationKey, string> = {
  father: 'ota', mother: 'ona', son: "o'g'il", daughter: 'qiz', brother: 'aka/uka', sister: 'opa/singil',
  husband: 'er', wife: 'xotin', amaki: 'amaki', amma: 'amma', togha: "tog'a", kelin: 'kelin', kuyov: 'kuyov',
};
