import { z } from 'zod';

export const GoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
});

export const CreateCarePlanRequestSchema = z.object({
  handoffId: z.string().min(1),
  goals: z.array(GoalSchema).min(1),
  assignedModuleIds: z.array(z.string()),
  checkInFrequency: z.string().min(1),
  boundaries: z.array(z.string()),
  followUpDate: z.string().optional(),
});

export const TransitionCarePlanRequestSchema = z.object({
  action: z.enum(['propose', 'approve', 'accept', 'revise', 'pause', 'retire']),
  changes: z.object({
    goals: z.array(GoalSchema).optional(),
    assignedModuleIds: z.array(z.string()).optional(),
    checkInFrequency: z.string().optional(),
    boundaries: z.array(z.string()).optional(),
    followUpDate: z.string().optional(),
  }).optional(),
});

export type CreateCarePlanRequest = z.infer<typeof CreateCarePlanRequestSchema>;
export type TransitionCarePlanRequest = z.infer<typeof TransitionCarePlanRequestSchema>;
