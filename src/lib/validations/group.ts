import { z } from 'zod';

const pickedUser = z.object({ id: z.number(), name: z.string(), designation: z.string().nullable() });
const pickedProject = z.object({ id: z.number(), name: z.string() });

export const groupFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(150, 'Name must be at most 150 characters.'),
    description: z.string().trim().max(1000, 'Description must be at most 1000 characters.'),
    is_active: z.boolean(),
    /** Create only: members join with their default role */
    users: z.array(pickedUser),
    /** Create only: projects the group is attached to */
    projects: z.array(pickedProject),
  })
  // Mirrors the backend rule
  .refine((v) => v.is_active || v.projects.length === 0, {
    path: ['projects'],
    message: 'An inactive group cannot be attached to projects.',
  });

export type GroupFormValues = z.infer<typeof groupFormSchema>;
