import { z } from 'zod';
import { emailField } from './auth';

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters.`);

export const userFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100, 'Name must be at most 100 characters.'),
  email: emailField,
  designation: optionalText(100, 'Job title'),
  department: optionalText(100, 'Department'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[\d\s-]{7,20}$/.test(v), 'Enter a valid phone number.'),
  /** Role name; empty string means no default role */
  default_role: z.string(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
