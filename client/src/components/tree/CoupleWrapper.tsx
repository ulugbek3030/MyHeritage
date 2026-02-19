import type { Person, Relationship } from '../../types';
import PersonCard from './PersonCard';

interface CoupleWrapperProps {
  person1: Person;
  person2: Person;
  relationship: Relationship;
  ownerPersonId: string | null;
  animationBaseDelay?: number;
  onCardClick?: (person: Person) => void;
  onAddClick?: (person: Person) => void;
  onEditClick?: (person: Person) => void;
  onDeleteClick?: (person: Person) => void;
}

export default function CoupleWrapper({
  person1,
  person2,
  relationship,
  ownerPersonId,
  animationBaseDelay = 0,
  onCardClick,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: CoupleWrapperProps) {
  const isDivorced = relationship.coupleStatus === 'divorced';

  return (
    <div className="couple">
      <PersonCard
        person={person1}
        isOwner={person1.id === ownerPersonId}
        animationDelay={animationBaseDelay}
        onCardClick={onCardClick}
        onAddClick={onAddClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />

      {isDivorced ? (
        <div className="couple-badge-divorced">Разведены</div>
      ) : (
        <div className="couple-heart">💕</div>
      )}

      <PersonCard
        person={person2}
        isOwner={person2.id === ownerPersonId}
        animationDelay={animationBaseDelay + 0.08}
        onCardClick={onCardClick}
        onAddClick={onAddClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
    </div>
  );
}
