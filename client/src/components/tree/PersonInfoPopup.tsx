import type { Person, Relationship } from '../../types';

const MaleIconLg = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/>
  </svg>
);

const FemaleIconLg = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.4c-1.5 0-2.7.5-3.6 1.3C7.9 3.5 7.4 3.4 6.8 3.4c-2.2 0-3.6 1.8-3.6 3.8 0 .8.2 1.5.5 2.1C2.7 10.5 2.4 12 2.4 12s1.2.6 2.4.6c.3 0 .6 0 .8-.1.8 1.4 2.3 3.1 4 3.9V18c-3.2.5-7.2 1.8-7.2 3.6v1.2h19.2v-1.2c0-1.8-4-3.1-7.2-3.6v-1.6c1.7-.8 3.2-2.5 4-3.9.3.1.5.1.8.1 1.2 0 2.4-.6 2.4-.6s-.3-1.5-1.3-2.7c.3-.6.5-1.3.5-2.1 0-2-1.4-3.8-3.6-3.8-.6 0-1.1.1-1.6.3-.9-.8-2.1-1.3-3.6-1.3z"/>
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

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

interface PersonInfoPopupProps {
  person: Person;
  allPersons?: Person[];
  relationships?: Relationship[];
  onClose: () => void;
  onEdit?: (person: Person) => void;
  onDelete?: (person: Person) => void;
}

/** Derive family connections for a person */
function getRelationships(
  person: Person,
  allPersons: Person[],
  relationships: Relationship[]
) {
  const personMap = new Map(allPersons.map(p => [p.id, p]));
  const getName = (id: string) => {
    const p = personMap.get(id);
    if (!p) return '?';
    const parts = [p.firstName];
    if (p.lastName) parts.push(p.lastName);
    return parts.join(' ');
  };

  const parents: { name: string; role: string }[] = [];
  const children: { name: string; gender: string }[] = [];
  const spouses: { name: string; status: string }[] = [];

  for (const rel of relationships) {
    if (rel.category === 'parent_child') {
      // person1Id = parent, person2Id = child
      if (rel.person2Id === person.id) {
        // This person is the child → person1Id is a parent
        const parent = personMap.get(rel.person1Id);
        if (parent) {
          parents.push({
            name: getName(rel.person1Id),
            role: parent.gender === 'male' ? 'Отец' : 'Мать',
          });
        }
      }
      if (rel.person1Id === person.id) {
        // This person is the parent → person2Id is a child
        const child = personMap.get(rel.person2Id);
        children.push({ name: getName(rel.person2Id), gender: child?.gender || 'male' });
      }
    }

    if (rel.category === 'couple') {
      let spouseId: string | null = null;
      if (rel.person1Id === person.id) spouseId = rel.person2Id;
      if (rel.person2Id === person.id) spouseId = rel.person1Id;
      if (spouseId) {
        const statusLabels: Record<string, string> = {
          married: 'Супруг(а)',
          civil: 'Гр. брак',
          dating: 'Партнёр',
          divorced: 'Бывш. супруг(а)',
          widowed: 'Вдовец/Вдова',
          other: 'Партнёр',
        };
        spouses.push({
          name: getName(spouseId),
          status: statusLabels[rel.coupleStatus || 'married'] || 'Супруг(а)',
        });
      }
    }
  }

  // Siblings: find persons who share at least one parent with this person
  const parentIds = relationships
    .filter(r => r.category === 'parent_child' && r.person2Id === person.id)
    .map(r => r.person1Id);

  const siblings: { name: string; gender: string }[] = [];
  if (parentIds.length > 0) {
    const siblingIds = new Set<string>();
    for (const rel of relationships) {
      if (
        rel.category === 'parent_child' &&
        parentIds.includes(rel.person1Id) &&
        rel.person2Id !== person.id
      ) {
        siblingIds.add(rel.person2Id);
      }
    }
    for (const sibId of siblingIds) {
      const sib = personMap.get(sibId);
      siblings.push({ name: getName(sibId), gender: sib?.gender || 'male' });
    }
  }

  return { parents, children, spouses, siblings };
}

function formatDate(dateStr: string | null, yearOnly: number | null, dateKnown: boolean): string {
  if (dateKnown && dateStr) {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  if (yearOnly) return yearOnly.toString();
  return '—';
}

function fullName(person: Person): string {
  const parts: string[] = [person.firstName];
  if (person.lastName) parts.push(person.lastName);
  if (person.middleName) parts.push(person.middleName);
  if (person.maidenName) parts.push(`(${person.maidenName})`);
  return parts.join(' ');
}

export default function PersonInfoPopup({
  person,
  allPersons,
  relationships,
  onClose,
  onEdit,
  onDelete,
}: PersonInfoPopupProps) {
  // Derive family connections
  const familyInfo = allPersons && relationships
    ? getRelationships(person, allPersons, relationships)
    : null;
  const photoSrc = person.photoUrl
    ? (person.photoUrl.startsWith('http') ? person.photoUrl : `${API_BASE}${person.photoUrl}`)
    : null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="popup-overlay active" onClick={handleOverlayClick}>
      <div className="popup">
        {/* Header */}
        <div className="popup-header">
          <button className="popup-close" onClick={onClose}>x</button>

          <div className={`popup-avatar-lg ${person.gender}${!person.isAlive && photoSrc ? ' deceased-photo' : ''}`}>
            {photoSrc ? (
              <img src={photoSrc} alt={person.firstName} />
            ) : (
              person.gender === 'male' ? <MaleIconLg /> : <FemaleIconLg />
            )}
          </div>

          <div className="popup-name">{fullName(person)}</div>
        </div>

        {/* Body */}
        <div className="popup-body">
          {/* Family relationships */}
          {familyInfo && (familyInfo.parents.length > 0 || familyInfo.children.length > 0 || familyInfo.spouses.length > 0 || familyInfo.siblings.length > 0) && (
            <div className="popup-section">
              <div className="popup-section-title">Родственные связи</div>
              <div className="popup-relations">
                {familyInfo.parents.map((p, i) => (
                  <div key={`parent-${i}`} className="popup-relation-row">
                    <span className="popup-relation-label">{p.role}</span>
                    <span className="popup-relation-name">{p.name}</span>
                  </div>
                ))}
                {familyInfo.spouses.map((s, i) => (
                  <div key={`spouse-${i}`} className="popup-relation-row">
                    <span className="popup-relation-label">{s.status}</span>
                    <span className="popup-relation-name">{s.name}</span>
                  </div>
                ))}
                {familyInfo.siblings.map((s, i) => (
                  <div key={`sibling-${i}`} className="popup-relation-row">
                    <span className="popup-relation-label">{s.gender === 'male' ? 'Брат' : 'Сестра'}</span>
                    <span className="popup-relation-name">{s.name}</span>
                  </div>
                ))}
                {familyInfo.children.map((c, i) => (
                  <div key={`child-${i}`} className="popup-relation-row">
                    <span className="popup-relation-label">{c.gender === 'male' ? 'Сын' : 'Дочь'}</span>
                    <span className="popup-relation-name">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Basic info */}
          <div className="popup-section">
            <div className="popup-section-title">Основная информация</div>
            <div className="popup-grid">
              <div className="popup-field">
                <div className="popup-field-label">Пол</div>
                <div className="popup-field-value">
                  {person.gender === 'male' ? 'Мужской' : 'Женский'}
                </div>
              </div>
              <div className="popup-field">
                <div className="popup-field-label">Статус</div>
                <div className="popup-field-value">
                  <span className={`popup-status ${person.isAlive ? 'alive' : 'deceased-status'}`}>
                    {person.isAlive ? '● Жив(а)' : '● Умер(ла)'}
                  </span>
                </div>
              </div>
              <div className="popup-field">
                <div className="popup-field-label">Дата рождения</div>
                <div className="popup-field-value">
                  {formatDate(person.birthDate, person.birthYear, person.birthDateKnown)}
                </div>
              </div>
              {!person.isAlive && (
                <div className="popup-field">
                  <div className="popup-field-label">Дата смерти</div>
                  <div className="popup-field-value">
                    {formatDate(person.deathDate, person.deathYear, person.deathDateKnown)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Note */}
          {person.note && (
            <div className="popup-section">
              <div className="popup-section-title">Заметка</div>
              <div className="popup-note">{person.note}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="popup-actions">
          {onEdit && (
            <button className="popup-act-btn btn-edit" onClick={() => onEdit(person)}>
              <EditIcon />
              Редактировать
            </button>
          )}
          {onDelete && (
            <button className="popup-act-btn btn-delete" onClick={() => onDelete(person)}>
              <DeleteIcon />
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
