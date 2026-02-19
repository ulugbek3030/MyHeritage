// ═══════════ User ═══════════
export interface User {
  id: string;
  phone: string;
  avatarUrl: string | null;
}

// ═══════════ Auth ═══════════
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginData {
  phone: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  phone: string;
  password: string;
}

// ═══════════ Tree ═══════════
export interface Tree {
  id: string;
  name: string;
  description: string | null;
  ownerPersonId: string | null;
  personCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ═══════════ Person ═══════════
export type Gender = 'male' | 'female';

export interface Person {
  id: string;
  treeId?: string;
  firstName: string;
  lastName: string | null;
  middleName: string | null;
  maidenName: string | null;
  gender: Gender;
  birthDate: string | null;
  birthYear: number | null;
  birthDateKnown: boolean;
  isAlive: boolean;
  deathDate: string | null;
  deathYear: number | null;
  deathDateKnown: boolean;
  photoUrl: string | null;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ═══════════ Relationship ═══════════
export type RelationshipCategory = 'couple' | 'parent_child';
export type CoupleStatus = 'married' | 'civil' | 'dating' | 'divorced' | 'widowed' | 'other';
export type ChildRelation = 'biological' | 'adopted' | 'foster' | 'guardianship' | 'stepchild';

export interface Relationship {
  id: string;
  treeId?: string;
  category: RelationshipCategory;
  person1Id: string;
  person2Id: string;
  coupleStatus: CoupleStatus | null;
  childRelation: ChildRelation | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ═══════════ Generation ═══════════
export interface Generation {
  number: number;
  label: string;
  personIds: string[];
}

// ═══════════ Full Tree ═══════════
export interface FullTree {
  tree: {
    id: string;
    name: string;
    description: string | null;
    ownerPersonId: string | null;
  };
  persons: Person[];
  relationships: Relationship[];
  generations: Generation[];
}
