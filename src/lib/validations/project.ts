import { z } from 'zod';

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters.`);

export const projectMemberSchema = z.object({
  user_id: z.number(),
  name: z.string(),
  designation: z.string().nullable(),
  /** Empty string means "use the user's default role" */
  role: z.string(),
});

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(150, 'Name must be at most 150 characters.'),
    description: z.string().trim().min(1, 'Description is required.').max(2000, 'Description is too long.'),
    objective: optionalText(2000, 'Objective'),
    status: z.string().min(1, 'Pick a status.'),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    color: z.string(),
    start_date: z.string(),
    due_date: z.string(),
    status_ids: z.array(z.number()),
    members: z.array(projectMemberSchema),
  })
  .refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, {
    path: ['due_date'],
    message: 'Due date cannot be before the start date.',
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
export type ProjectMemberValue = z.infer<typeof projectMemberSchema>;

const requireStatuses = (v: ProjectFormValues, ctx: z.RefinementCtx) => {
  if (v.status_ids.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['status_ids'], message: 'Pick at least one workflow status.' });
  }
};

export const createProjectSchema = projectFormSchema.superRefine((v, ctx) => {
  requireStatuses(v, ctx);
  if (v.members.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['members'], message: 'Add at least one member.' });
  }
});

/** Editing may leave no direct members, since people can also join through groups */
export const editProjectSchema = projectFormSchema.superRefine(requireStatuses);
