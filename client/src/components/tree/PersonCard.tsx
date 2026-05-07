import type { Person } from '../../types';
import { formatLifespan } from '../../utils/dateFormat';
import '../../styles/tree.css';

interface Props {
  person: Person;
  isOwner?: boolean;
  hasUpcomingBirthday?: boolean;
  onClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
  showPlus?: boolean;
}

export const PersonCard = ({ person, isOwner, hasUpcomingBirthday, onClick, onPlusClick, showPlus }: Props) => {
  const cls = ['pcard', person.gender, !person.isAlive ? 'deceased' : '', isOwner ? 'me' : ''].filter(Boolean).join(' ');
  const initials = (person.firstName?.[0] ?? '?');

  return (
    <div className={cls} onClick={(e) => { e.stopPropagation(); onClick?.(person.id); }}>
      {person.verified && <span className="pcard-verified">✓</span>}
      <div className="pcard-av">
        {person.photoUrl ? <img src={person.photoUrl} alt="" /> : initials}
      </div>
      <div className="pcard-name">{person.firstName}{person.lastName ? <><br/>{person.lastName}</> : null}</div>
      <div className="pcard-year">{formatLifespan(person)}</div>
      {hasUpcomingBirthday && <div className="pcard-cake">🎂</div>}
      {showPlus && <div className="pcard-plus" onClick={(e) => { e.stopPropagation(); onPlusClick?.(person.id); }}>+</div>}
    </div>
  );
};
