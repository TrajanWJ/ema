import { z } from 'zod';

export const SettingSchema = z.object({
  id: z.number().int(),
  key: z.string().min(1),
  value: z.string(),
  inserted_at: z.string(),
  updated_at: z.string(),
});

export type Setting = z.infer<typeof SettingSchema>;

export const UpsertSettingSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.string(),
});

export type UpsertSettingInput = z.infer<typeof UpsertSettingSchema>;
