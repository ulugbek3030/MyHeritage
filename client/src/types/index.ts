export interface User { id: string; phone: string | null; email: string | null; displayName: string | null; avatarUrl: string | null; }
export interface Tree { id: string; userId: string; name: string; description: string | null; ownerPersonId: string | null; visibility: 'private' | 'link' | 'family' | 'public'; shareToken: string | null; personCount?: number; }
export interface Person {
  id: string; treeId: string; firstName: string; lastName: string | null; middleName: string | null; maidenName: string | null;
  gender: 'male' | 'female';
  birthDate: string | null; birthYear: number | null; birthDateKnown: boolean;
  isAlive: boolean; deathDate: string | null; deathYear: number | null; deathDateKnown: boolean;
  verified: boolean; note: string | null; photoUrl: string | null;
}
export type CoupleStatus = 'married' | 'civil' | 'dating' | 'divorced' | 'widowed' | 'other';
export type ChildRelation = 'biological' | 'adopted' | 'foster' | 'guardianship' | 'stepchild';
export interface Relationship { id: string; treeId: string; category: 'couple' | 'parent_child'; person1Id: string; person2Id: string; coupleStatus: CoupleStatus | null; childRelation: ChildRelation | null; startDate: string | null; endDate: string | null; }
export interface Generation { number: number; label: string; personIds: string[]; }
export interface FullTree { tree: Tree; persons: Person[]; relationships: Relationship[]; generations: Generation[]; }
export type EventType = 'birthday' | 'memorial' | 'anniversary' | 'child_birthday';
export interface FamilyEvent { type: EventType; date: string; daysUntil: number; personId?: string; personIds?: [string, string]; meta: { name: string; relation?: string; ageOnEvent?: number; yearsAgo?: number }; }
