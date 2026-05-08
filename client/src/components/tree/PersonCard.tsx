import type { Person } from '../../types';
import { formatLifespan } from '../../utils/dateFormat';
import { Silhouette, type SilhouetteKind } from '../ui/Silhouette';
import '../../styles/tree.css';

interface Props {
  person: Person;
  isOwner?: boolean;
  hasUpcomingBirthday?: boolean;
  onClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
  showPlus?: boolean;
}

const silhouetteKindFor = (p: Person): SilhouetteKind => {
  const yr = new Date().getUTCFullYear();
  const age = p.birthYear ? yr - p.birthYear : null;
  if (age !== null && age <= 14) return `child-${p.gender}` as SilhouetteKind;
  if (age !== null && age >= 50) return `older-${p.gender}` as SilhouetteKind;
  return `adult-${p.gender}` as SilhouetteKind;
};

export const PersonCard = ({ person, isOwner, hasUpcomingBirthday, onClick, onPlusClick, showPlus }: Props) => {
  const cls = ['pcard', person.gender, !person.isAlive ? 'deceased' : '', isOwner ? 'me' : ''].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      onClick={(e) => { e.stopPropagation(); onClick?.(person.id); }}
    >
      <div className="pcard-av">
        {person.photoUrl ? <img src={person.photoUrl} alt="" /> : <Silhouette kind={silhouetteKindFor(person)} size={36} />}
      </div>
      <div className="pcard-name">{person.firstName}{person.lastName ? <><br/>{person.lastName}</> : null}</div>
      <div className="pcard-year">{formatLifespan(person)}</div>
      {/* Always render the status pill so card heights match alive vs deceased.
          For living people it stays in layout but invisible. */}
      <div className="pcard-status" aria-hidden={person.isAlive} style={{ visibility: person.isAlive ? 'hidden' : 'visible' }}>
        {person.gender === 'female' ? 'Умерла' : 'Умер'}
      </div>
      {hasUpcomingBirthday && <div className="pcard-cake" aria-label="Скоро день рождения">🎁</div>}
      {showPlus && (
        <div className="pcard-plus" onClick={(e) => { e.stopPropagation(); onPlusClick?.(person.id); }}>
          {/* Bottom half of a horizontal ellipse. Two paths so the top edge
              doesn't double-stroke the card's bottom line:
                – fill path: closed shape, fill only
                – arc path: open, stroke only on the curved part */}
          <svg className="pcard-plus-shape" viewBox="0 0 70 19" preserveAspectRatio="none" aria-hidden="true">
            <path className="pcard-plus-fill" d="M 0 0 L 70 0 A 35 19 0 0 1 0 0 Z" />
            <path className="pcard-plus-arc" d="M 0 0 A 35 19 0 0 0 70 0" />
          </svg>
          <span className="pcard-plus-icon">+</span>
        </div>
      )}
    </div>
  );
};
