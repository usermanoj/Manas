import { z } from 'zod';
import { StructuredCheckInSchema } from '../ai/schemas';

export const CreateHandoffRequestSchema = z.object({
  providerId: z.string(),
  structuredSummary: StructuredCheckInSchema,
  excludedEntries: z.array(z.string()).default([]),
  userNote: z.string().max(500).optional(),
});

export type CreateHandoffRequest = z.infer<typeof CreateHandoffRequestSchema>;

export const UpdateHandoffRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('edit_fields'),
    structuredSummary: StructuredCheckInSchema.optional(),
    userNote: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('exclude_entry'),
    fieldKey: z.string(),
  }),
  z.object({
    action: z.literal('add_note'),
    userNote: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('submit_for_review'),
  }),
]);

export type UpdateHandoffRequest = z.infer<typeof UpdateHandoffRequestSchema>;

export const HandoffResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  providerId: z.string(),
  status: z.string(),
  structuredSummary: StructuredCheckInSchema,
  excludedEntries: z.array(z.string()),
  userNote: z.string().optional(),
  version: z.number(),
});

export type HandoffResponse = z.infer<typeof HandoffResponseSchema>;

/**
 * Build preview: summary minus excluded fields, plus userNote.
 */
export type HandoffPreview = {
  includedFields: Record<string, unknown>;
  excludedFields: string[];
  userNote?: string;
};
