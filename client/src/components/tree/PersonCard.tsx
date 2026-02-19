import type { Person } from '../../types';

/* SVG icons inline */
const MaleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/>
  </svg>
);

const FemaleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.4c-1.5 0-2.7.5-3.6 1.3C7.9 3.5 7.4 3.4 6.8 3.4c-2.2 0-3.6 1.8-3.6 3.8 0 .8.2 1.5.5 2.1C2.7 10.5 2.4 12 2.4 12s1.2.6 2.4.6c.3 0 .6 0 .8-.1.8 1.4 2.3 3.1 4 3.9V18c-3.2.5-7.2 1.8-7.2 3.6v1.2h19.2v-1.2c0-1.8-4-3.1-7.2-3.6v-1.6c1.7-.8 3.2-2.5 4-3.9.3.1.5.1.8.1 1.2 0 2.4-.6 2.4-.6s-.3-1.5-1.3-2.7c.3-.6.5-1.3.5-2.1 0-2-1.4-3.8-3.6-3.8-.6 0-1.1.1-1.6.3-.9-.8-2.1-1.3-3.6-1.3z"/>
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);


const OwnerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

interface PersonCardProps {
  person: Person;
  isOwner?: boolean;
  animationDelay?: number;
  onCardClick?: (person: Person) => void;
  onAddClick?: (person: Person) => void;
  onEditClick?: (person: Person) => void;
  onDeleteClick?: (person: Person) => void;
}

function formatDateShort(dateStr: string | null, yearOnly: number | null, dateKnown: boolean): string {
  if (dateKnown && dateStr) {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  if (yearOnly) return yearOnly.toString();
  return '';
}

function formatYears(person: Person): string {
  const birth = formatDateShort(person.birthDate, person.birthYear, person.birthDateKnown);

  if (!birth && !person.isAlive) return '';
  if (!birth && person.isAlive) return '';

  const death = !person.isAlive
    ? formatDateShort(person.deathDate, person.deathYear, person.deathDateKnown) || '?'
    : '';

  if (!person.isAlive) {
    return `${birth || '?'} — ${death}`;
  }
  return birth;
}

function formatFullName(person: Person): string {
  const parts: string[] = [person.firstName];
  if (person.lastName) parts.push(person.lastName);
  if (person.middleName) parts.push(person.middleName);
  if (person.maidenName) parts.push(`(${person.maidenName})`);
  return parts.join(' ');
}

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export default function PersonCard({
  person,
  isOwner = false,
  animationDelay = 0,
  onCardClick,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: PersonCardProps) {
  const classes = [
    'card',
    person.gender,
    !person.isAlive ? 'deceased' : '',
    isOwner ? 'owner' : '',
  ].filter(Boolean).join(' ');

  const years = formatYears(person);
  const photoSrc = person.photoUrl
    ? (person.photoUrl.startsWith('http') ? person.photoUrl : `${API_BASE}${person.photoUrl}`)
    : null;

  return (
    <div
      className={classes}
      data-person-id={person.id}
      style={animationDelay ? { animationDelay: `${animationDelay}s` } : undefined}
    >
      {/* Card actions (edit/delete) */}
      <div className="card-actions">
        {onEditClick && (
          <button
            className="card-act-btn act-edit"
            onClick={(e) => { e.stopPropagation(); onEditClick(person); }}
          >
            <EditIcon />
          </button>
        )}
        {onDeleteClick && (
          <button
            className="card-act-btn act-delete"
            onClick={(e) => { e.stopPropagation(); onDeleteClick(person); }}
          >
            <DeleteIcon />
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="card-body" onClick={() => onCardClick?.(person)}>
        <div className="avatar">
          {photoSrc ? (
            <img src={photoSrc} alt={person.firstName} />
          ) : (
            person.gender === 'male' ? <MaleIcon /> : <FemaleIcon />
          )}
        </div>

        <div className="card-name">
          <span className="card-name-first">{person.firstName}</span>
          {(person.lastName || person.middleName || person.maidenName) && (
            <span className="card-name-rest">
              {[person.lastName, person.middleName].filter(Boolean).join(' ')}
              {person.maidenName && ` (${person.maidenName})`}
            </span>
          )}
        </div>

        {years && <div className="card-years">{years}</div>}

        {!person.isAlive && (
          <div>
            <span className="badge-deceased">
              {person.gender === 'male' ? 'Умер' : 'Умерла'}
            </span>
          </div>
        )}

        {isOwner && (
          <div>
            <span className="badge-owner">
              <OwnerIcon />
              Это вы
            </span>
          </div>
        )}
      </div>

      {/* Plus tab */}
      {onAddClick && (
        <button
          className="plus-tab"
          onClick={(e) => { e.stopPropagation(); onAddClick(person); }}
          aria-label="Добавить родственника"
        >
          <PlusIcon />
        </button>
      )}
    </div>
  );
}
