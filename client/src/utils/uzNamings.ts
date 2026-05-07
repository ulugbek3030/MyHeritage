export const generateMiddleName = (fatherFirstName: string | null, gender: 'male' | 'female'): string => {
  if (!fatherFirstName) return '';
  const suffix = gender === 'male' ? "o'g'li" : 'qizi';
  return `${fatherFirstName} ${suffix}`;
};

/**
 * Adjust a Slavic-style surname (-ов/-ев/-ин/-ский …) to match the target gender.
 *   • female: append "а" if missing  (Рустамов → Рустамова, Иванский → Иванская)
 *   • male:   strip trailing "а"      (Рустамова → Рустамов, Иванская → Иванский)
 * No-op for surnames already in the target form (e.g. "Khan" stays unchanged).
 */
export const adjustSurnameForGender = (surname: string, targetGender: 'male' | 'female'): string => {
  const trimmed = (surname ?? '').trim();
  if (!trimmed) return '';
  const endsInA = /[ая]$/i.test(trimmed);
  if (targetGender === 'female' && !endsInA) {
    if (/(ский|цкий)$/i.test(trimmed)) return trimmed.replace(/ий$/i, 'ая');
    return trimmed + 'а';
  }
  if (targetGender === 'male' && endsInA) {
    if (/(ская|цкая)$/i.test(trimmed)) return trimmed.replace(/ая$/i, 'ий');
    return trimmed.replace(/а$/i, '');
  }
  return trimmed;
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
