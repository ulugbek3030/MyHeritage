import type { Person, Relationship } from '../../types';

interface ConfirmDeleteDialogProps {
  person: Person;
  allPersons: Person[];
  relationships: Relationship[];
  ownerPersonId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Find persons who will become unreachable from the owner
 * after deleting the target person.
 * Uses BFS from owner, excluding the target person and their relationships.
 */
function findOrphaned(
  targetId: string,
  ownerPersonId: string,
  allPersons: Person[],
  relationships: Relationship[]
): Person[] {
  // Build adjacency graph without the target person
  const adj = new Map<string, Set<string>>();
  for (const p of allPersons) {
    if (p.id !== targetId) adj.set(p.id, new Set());
  }
  for (const rel of relationships) {
    if (rel.person1Id === targetId || rel.person2Id === targetId) continue;
    adj.get(rel.person1Id)?.add(rel.person2Id);
    adj.get(rel.person2Id)?.add(rel.person1Id);
  }

  // BFS from owner
  const reachable = new Set<string>();
  const queue = [ownerPersonId];
  reachable.add(ownerPersonId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const neighbor of adj.get(cur) || []) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // Persons not reachable (excluding target itself)
  return allPersons.filter(p => p.id !== targetId && !reachable.has(p.id));
}

function fullName(person: Person): string {
  const parts: string[] = [person.firstName];
  if (person.lastName) parts.push(person.lastName);
  return parts.join(' ');
}

export default function ConfirmDeleteDialog({
  person,
  allPersons,
  relationships,
  ownerPersonId,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const isOwner = person.id === ownerPersonId;
  const orphaned = ownerPersonId && !isOwner
    ? findOrphaned(person.id, ownerPersonId, allPersons, relationships)
    : [];

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="popup-overlay active" onClick={handleOverlayClick}>
      <div className="confirm-dialog">
        <div className="confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="confirm-title">Удалить {fullName(person)}?</div>

        {isOwner && (
          <div className="confirm-warning">
            Это владелец дерева. Удаление приведёт к потере всех родственников.
          </div>
        )}

        {orphaned.length > 0 && (
          <div className="confirm-warning">
            Связь через {fullName(person)} оборвётся, и следующие родственники
            тоже будут удалены:
            <ul className="confirm-orphan-list">
              {orphaned.map(p => (
                <li key={p.id}>{fullName(p)}</li>
              ))}
            </ul>
          </div>
        )}

        {orphaned.length === 0 && !isOwner && (
          <div className="confirm-text">
            Это действие нельзя отменить.
          </div>
        )}

        <div className="confirm-actions">
          <button className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            Отмена
          </button>
          <button className="confirm-btn confirm-btn-delete" onClick={onConfirm}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
