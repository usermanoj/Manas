import { z } from 'zod';

export const ConsentAndSendRequestSchema = z.object({
  explicitConsent: z.literal(true),
  consentVersion: z.string().min(1),
  previewHash: z.string().min(1),
});

export const CreateHandoffRequestSchema = z.object({
  providerId: z.string().min(1),
  structuredSummary: z.record(z.string(), z.unknown()),
  excludedEntries: z.array(z.string()).optional().default([]),
});

export type ConsentAndSendRequest = z.infer<typeof ConsentAndSendRequestSchema>;
export type CreateHandoffRequest = z.infer<typeof CreateHandoffRequestSchema>;
