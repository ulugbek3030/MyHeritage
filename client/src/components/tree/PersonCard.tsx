import { useRef } from 'react';
import type { Person } from '../../types';
import { formatLifespan } from '../../utils/dateFormat';
import { useLongPress } from '../../hooks/useLongPress';
import '../../styles/tree.css';

interface Props {
  person: Person;
  isOwner?: boolean;
  hasUpcomingBirthday?: boolean;
  onClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
  onLongPress?: (id: string, pos: { x: number; y: number }) => void;
  showPlus?: boolean;
}

export const PersonCard = ({ person, isOwner, hasUpcomingBirthday, onClick, onPlusClick, onLongPress, showPlus }: Props) => {
  const cls = ['pcard', person.gender, !person.isAlive ? 'deceased' : '', isOwner ? 'me' : ''].filter(Boolean).join(' ');
  const initials = (person.firstName?.[0] ?? '?');
  const lastPos = useRef({ x: 0, y: 0 });

  const lp = useLongPress(() => onLongPress?.(person.id, lastPos.current));

  const captureMouse = (e: React.MouseEvent) => {
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const captureTouch = (e: React.TouchEvent) => {
    if (e.touches[0]) lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  return (
    <div
      className={cls}
      onClick={(e) => { e.stopPropagation(); onClick?.(person.id); }}
      onMouseDown={(e) => { captureMouse(e); lp.onMouseDown(); }}
      onMouseUp={lp.onMouseUp}
      onMouseLeave={lp.onMouseLeave}
      onTouchStart={(e) => { captureTouch(e); lp.onTouchStart(); }}
      onTouchEnd={lp.onTouchEnd}
    >
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
