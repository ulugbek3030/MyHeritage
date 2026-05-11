/**
 * Human-figure silhouettes for avatars and role-pickers. Single shape, filled
 * via `currentColor` so the parent element's `color` tints by gender.
 *   • adult-{male,female} — default body
 *   • child-{male,female} — toddler-ish proportions (big head, tiny body)
 *   • older-{male,female} — parents (receding hair / hair bun)
 */
export type SilhouetteKind =
  | 'adult-male' | 'adult-female'
  | 'child-male' | 'child-female'
  | 'older-male' | 'older-female';

interface Props {
  kind: SilhouetteKind;
  size?: number;
}

export const Silhouette = ({ kind, size = 44 }: Props) => {
  switch (kind) {
    case 'adult-male':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M 32 7 C 23 7, 17 13, 17 23 L 17 28 C 19 25, 22 23, 26 21 C 28 17, 32 16, 32 16 C 32 16, 36 17, 38 21 C 42 23, 45 25, 47 28 L 47 23 C 47 13, 41 7, 32 7 Z" />
          <path d="M 18 28 L 18 31 C 18 33, 19 35, 21 35 L 21 33 C 19 33, 19 30, 19 28 Z" />
          <path d="M 46 28 L 46 31 C 46 33, 45 35, 43 35 L 43 33 C 45 33, 45 30, 45 28 Z" />
          <path d="M 21 24 L 21 31 C 21 37, 26 41, 32 41 C 38 41, 43 37, 43 31 L 43 24 C 43 30, 38 34, 32 34 C 26 34, 21 30, 21 24 Z" />
          <path fillRule="evenodd" d="M 27 41 L 27 44 C 23 45, 19 47, 16 49 L 10 53 L 10 64 L 54 64 L 54 53 L 48 49 C 45 47, 41 45, 37 44 L 37 41 C 35 42, 33 42, 32 42 C 31 42, 29 42, 27 41 Z M 29 45 L 32 53 L 35 45 Z" />
        </svg>
      );
    case 'adult-female':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M 32 6 C 21 6, 14 12, 14 23 L 14 38 C 14 40, 15 42, 17 43 L 22 43 L 22 41 C 19 41, 18 38, 18 33 L 18 28 C 19 25, 22 23, 26 21 C 28 17, 32 16, 32 16 C 32 16, 36 17, 38 21 C 42 23, 45 25, 46 28 L 46 33 C 46 38, 45 41, 42 41 L 42 43 L 47 43 C 49 42, 50 40, 50 38 L 50 23 C 50 12, 43 6, 32 6 Z" />
          <path d="M 18 28 L 18 31 C 18 33, 19 35, 21 35 L 21 33 C 19 33, 19 30, 19 28 Z" />
          <path d="M 46 28 L 46 31 C 46 33, 45 35, 43 35 L 43 33 C 45 33, 45 30, 45 28 Z" />
          <path d="M 21 24 L 21 31 C 21 37, 26 41, 32 41 C 38 41, 43 37, 43 31 L 43 24 C 43 30, 38 34, 32 34 C 26 34, 21 30, 21 24 Z" />
          <path fillRule="evenodd" d="M 27 41 L 27 44 C 23 45, 19 47, 16 49 L 10 53 L 10 64 L 54 64 L 54 53 L 48 49 C 45 47, 41 45, 37 44 L 37 41 C 35 42, 33 42, 32 42 C 31 42, 29 42, 27 41 Z M 28 45 C 28 50, 30 52, 32 52 C 34 52, 36 50, 36 45 Z" />
        </svg>
      );
    case 'child-male':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M 32 4 C 19 4, 11 12, 11 23 L 11 32 C 13 29, 17 26, 22 24 C 26 19, 32 18, 32 18 C 32 18, 38 19, 42 24 C 47 26, 51 29, 53 32 L 53 23 C 53 12, 45 4, 32 4 Z" />
          <path d="M 12 31 L 12 37 C 12 40, 14 42, 16 42 L 16 40 C 14 40, 13 38, 13 31 Z" />
          <path d="M 52 31 L 52 37 C 52 40, 50 42, 48 42 L 48 40 C 50 40, 51 38, 51 31 Z" />
          <path d="M 15 26 L 15 37 C 15 45, 22 50, 32 50 C 42 50, 49 45, 49 37 L 49 26 C 49 35, 42 40, 32 40 C 22 40, 15 35, 15 26 Z" />
          <path fillRule="evenodd" d="M 27 50 L 27 52 C 24 53, 21 54, 18 55 L 14 58 L 14 64 L 50 64 L 50 58 L 46 55 C 43 54, 40 53, 37 52 L 37 50 C 35 51, 33 51, 32 51 C 31 51, 29 51, 27 50 Z M 29 53 L 32 58 L 35 53 Z" />
        </svg>
      );
    case 'child-female':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M 32 4 C 19 4, 11 12, 11 24 L 11 41 C 11 43, 12 45, 14 46 L 18 46 L 18 44 C 16 44, 15 41, 15 37 L 15 32 C 17 29, 20 27, 24 25 C 27 19, 32 18, 32 18 C 32 18, 37 19, 40 25 C 44 27, 47 29, 49 32 L 49 37 C 49 41, 48 44, 46 44 L 46 46 L 50 46 C 52 45, 53 43, 53 41 L 53 24 C 53 12, 45 4, 32 4 Z" />
          <path d="M 12 31 L 12 37 C 12 40, 14 42, 16 42 L 16 40 C 14 40, 13 38, 13 31 Z" />
          <path d="M 52 31 L 52 37 C 52 40, 50 42, 48 42 L 48 40 C 50 40, 51 38, 51 31 Z" />
          <path d="M 15 26 L 15 37 C 15 45, 22 50, 32 50 C 42 50, 49 45, 49 37 L 49 26 C 49 35, 42 40, 32 40 C 22 40, 15 35, 15 26 Z" />
          <path fillRule="evenodd" d="M 27 50 L 27 52 C 24 53, 21 54, 18 55 L 14 58 L 14 64 L 50 64 L 50 58 L 46 55 C 43 54, 40 53, 37 52 L 37 50 C 35 51, 33 51, 32 51 C 31 51, 29 51, 27 50 Z M 28 53 C 28 57, 30 58, 32 58 C 34 58, 36 57, 36 53 Z" />
        </svg>
      );
    case 'older-male':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M 17 23 C 17 14, 22 9, 28 9 L 28 13 C 24 14, 21 18, 21 24 L 21 30 C 19 30, 17 28, 17 26 Z" />
          <path d="M 47 23 C 47 14, 42 9, 36 9 L 36 13 C 40 14, 43 18, 43 24 L 43 30 C 45 30, 47 28, 47 26 Z" />
          <path d="M 18 28 L 18 31 C 18 33, 19 35, 21 35 L 21 33 C 19 33, 19 30, 19 28 Z" />
          <path d="M 46 28 L 46 31 C 46 33, 45 35, 43 35 L 43 33 C 45 33, 45 30, 45 28 Z" />
          <path d="M 21 18 L 21 31 C 21 37, 26 41, 32 41 C 38 41, 43 37, 43 31 L 43 18 C 43 13, 38 11, 32 11 C 26 11, 21 13, 21 18 Z" />
          <path d="M 24 36 C 25 39, 28 41, 32 41 C 36 41, 39 39, 40 36 C 38 39, 35 40, 32 40 C 29 40, 26 39, 24 36 Z" />
          <path fillRule="evenodd" d="M 27 41 L 27 44 C 23 45, 19 47, 16 49 L 10 53 L 10 64 L 54 64 L 54 53 L 48 49 C 45 47, 41 45, 37 44 L 37 41 C 35 42, 33 42, 32 42 C 31 42, 29 42, 27 41 Z M 29 45 L 32 53 L 35 45 Z" />
        </svg>
      );
    case 'older-female':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M 32 7 C 23 7, 17 13, 17 23 L 17 28 C 19 25, 22 23, 26 22 C 28 18, 32 17, 32 17 C 32 17, 36 18, 38 22 C 42 23, 45 25, 47 28 L 47 23 C 47 13, 41 7, 32 7 Z" />
          <circle cx="32" cy="14" r="5" />
          <path d="M 18 28 L 18 31 C 18 33, 19 35, 21 35 L 21 33 C 19 33, 19 30, 19 28 Z" />
          <path d="M 46 28 L 46 31 C 46 33, 45 35, 43 35 L 43 33 C 45 33, 45 30, 45 28 Z" />
          <path d="M 21 24 L 21 31 C 21 37, 26 41, 32 41 C 38 41, 43 37, 43 31 L 43 24 C 43 30, 38 34, 32 34 C 26 34, 21 30, 21 24 Z" />
          <path fillRule="evenodd" d="M 27 41 L 27 44 C 23 45, 19 47, 16 49 L 10 53 L 10 64 L 54 64 L 54 53 L 48 49 C 45 47, 41 45, 37 44 L 37 41 C 35 42, 33 42, 32 42 C 31 42, 29 42, 27 41 Z M 28 45 C 28 50, 30 52, 32 52 C 34 52, 36 50, 36 45 Z" />
        </svg>
      );
  }
};
