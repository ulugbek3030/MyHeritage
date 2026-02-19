import { z } from 'zod';

// Auth (phone-based)
export const registerSchema = z.object({
  phone: z.string().regex(/^\+?\d{7,15}$/, 'Неверный формат номера телефона'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
});

export const loginSchema = z.object({
  phone: z.string().regex(/^\+?\d{7,15}$/, 'Неверный формат номера телефона'),
  password: z.string().min(1, 'Введите пароль'),
});

// Trees
export const createTreeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

export const updateTreeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  ownerPersonId: z.string().uuid().optional().nullable(),
});

// Persons
export const createPersonSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().nullable(),
  middleName: z.string().max(100).optional().nullable(),
  maidenName: z.string().max(100).optional().nullable(),
  gender: z.enum(['male', 'female']),
  birthDate: z.string().optional().nullable(),
  birthYear: z.number().min(1800).max(2100).optional().nullable(),
  birthDateKnown: z.boolean().optional().default(false),
  isAlive: z.boolean().optional().default(true),
  deathDate: z.string().optional().nullable(),
  deathYear: z.number().min(1800).max(2100).optional().nullable(),
  deathDateKnown: z.boolean().optional().default(false),
  note: z.string().optional().nullable(),
  // Optional: create relationship at the same time
  relationships: z.array(z.object({
    category: z.enum(['couple', 'parent_child']),
    relatedPersonId: z.string().uuid(),
    coupleStatus: z.enum(['married', 'civil', 'dating', 'divorced', 'widowed', 'other']).optional(),
    childRelation: z.enum(['biological', 'adopted', 'foster', 'guardianship', 'stepchild']).optional(),
  })).optional(),
});

export const updatePersonSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional().nullable(),
  middleName: z.string().max(100).optional().nullable(),
  maidenName: z.string().max(100).optional().nullable(),
  gender: z.enum(['male', 'female']).optional(),
  birthDate: z.string().optional().nullable(),
  birthYear: z.number().min(1800).max(2100).optional().nullable(),
  birthDateKnown: z.boolean().optional(),
  isAlive: z.boolean().optional(),
  deathDate: z.string().optional().nullable(),
  deathYear: z.number().min(1800).max(2100).optional().nullable(),
  deathDateKnown: z.boolean().optional(),
  note: z.string().optional().nullable(),
});

// Relationships
export const createRelationshipSchema = z.object({
  category: z.enum(['couple', 'parent_child']),
  person1Id: z.string().uuid(),
  person2Id: z.string().uuid(),
  coupleStatus: z.enum(['married', 'civil', 'dating', 'divorced', 'widowed', 'other']).optional(),
  childRelation: z.enum(['biological', 'adopted', 'foster', 'guardianship', 'stepchild']).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const updateRelationshipSchema = z.object({
  coupleStatus: z.enum(['married', 'civil', 'dating', 'divorced', 'widowed', 'other']).optional(),
  childRelation: z.enum(['biological', 'adopted', 'foster', 'guardianship', 'stepchild']).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
