import { z } from 'zod';

export const phoneSchema = z.string().regex(/^\+?\d{9,15}$/, 'Invalid phone');

export const requestOtpSchema = z.object({ phone: phoneSchema });
export const verifyOtpSchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{4,6}$/) });
export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const createTreeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

export const genderSchema = z.enum(['male', 'female']);
export const coupleStatusSchema = z.enum(['married', 'civil', 'dating', 'divorced', 'widowed', 'other']);
export const childRelationSchema = z.enum(['biological', 'adopted', 'foster', 'guardianship', 'stepchild']);

export const createPersonSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  middleName: z.string().max(100).optional(),
  maidenName: z.string().max(100).optional(),
  gender: genderSchema,
  birthDate: z.string().date().optional(),
  birthYear: z.number().int().min(1800).max(2100).optional(),
  birthDateKnown: z.boolean().default(false),
  isAlive: z.boolean().default(true),
  deathDate: z.string().date().optional(),
  deathYear: z.number().int().min(1800).max(2100).optional(),
  deathDateKnown: z.boolean().default(false),
  note: z.string().optional(),
  relationships: z
    .array(
      z.object({
        category: z.enum(['couple', 'parent_child']),
        otherPersonId: z.string().uuid(),
        role: z.enum(['parent', 'child', 'spouse']).optional(),
        coupleStatus: coupleStatusSchema.optional(),
        childRelation: childRelationSchema.optional(),
      }),
    )
    .optional(),
});

export const createRelationshipSchema = z.object({
  category: z.enum(['couple', 'parent_child']),
  person1Id: z.string().uuid(),
  person2Id: z.string().uuid(),
  coupleStatus: coupleStatusSchema.optional(),
  childRelation: childRelationSchema.optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  note: z.string().optional(),
});
