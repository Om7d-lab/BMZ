import { z } from 'zod';
import { cuid, hexColor, tagCategory } from './common.js';

export const tag = z.object({
  id: cuid,
  name: z.string(),
  category: tagCategory,
  color: z.string().nullable(),
  description: z.string().nullable(),
  /** How many trades carry this tag, for the management screen. */
  tradeCount: z.number().int().nonnegative().optional(),
});
export type Tag = z.infer<typeof tag>;

export const createTagRequest = z.object({
  name: z.string().trim().min(1).max(60),
  category: tagCategory.default('CUSTOM'),
  color: hexColor.nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});
export type CreateTagRequest = z.infer<typeof createTagRequest>;

export const updateTagRequest = createTagRequest.partial();
export type UpdateTagRequest = z.infer<typeof updateTagRequest>;
