import type { Person } from '../../types';
import { formatLifespan } from '../../utils/dateFormat';
import { Silhouette, type SilhouetteKind } from '../ui/Silhouette';
import '../../styles/tree.css';

interface Props {
  person: Person;
  isOwner?: boolean;
  /** Distinct icons for events in the current month (matches calendar). */
  eventIcons?: string[];
  onClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
  showPlus?: boolean;
  /** When set, a small "tunnel" icon is rendered on the top-left of the
   *  card. Tapping it calls onTunnelClick(treeId). Used for persons whose
   *  phone matches a granted Click user — tap takes you into their tree. */
  tunnelTreeId?: string | null;
  onTunnelClick?: (treeId: string) => void;
}

const silhouetteKindFor = (p: Person): SilhouetteKind => {
  const yr = new Date().getUTCFullYear();
  const age = p.birthYear ? yr - p.birthYear : null;
  if (age !== null && age <= 14) return `child-${p.gender}` as SilhouetteKind;
  if (age !== null && age >= 50) return `older-${p.gender}` as SilhouetteKind;
  return `adult-${p.gender}` as SilhouetteKind;
};

export const PersonCard = ({ person, isOwner, eventIcons, onClick, onPlusClick, showPlus, tunnelTreeId, onTunnelClick }: Props) => {
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
      {eventIcons && eventIcons.length > 0 && (
        <div className="pcard-events" aria-label="События в этом месяце">
          {eventIcons.slice(0, 3).map((icon, i) => <span key={i} aria-hidden="true">{icon}</span>)}
        </div>
      )}
      {tunnelTreeId && onTunnelClick && (
        <button
          type="button"
          className="pcard-tunnel"
          aria-label="Открыть древо этого родственника"
          onClick={(e) => { e.stopPropagation(); onTunnelClick(tunnelTreeId); }}
        >
          {/* Tunnel-shaped SVG: trapezoid with a rounded top, the visual
              metaphor of "passing through" to another tree. */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 21 L7 7 Q12 3 17 7 L21 21 Z" />
            <line x1="12" y1="11" x2="12" y2="21" />
          </svg>
        </button>
      )}
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
