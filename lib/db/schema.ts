import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const bots = pgTable(
  'bots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    avatar: text('avatar')
      .notNull()
      .$defaultFn(() => nanoid()),
    job: text('job').notNull(),
    instructions: text('instructions'),
    sandboxId: text('sandbox_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('bots_user_id_idx').on(table.userId)]
);

export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;

export const insertBotSchema = createInsertSchema(bots, {
  name: (schema) => schema.min(1, 'Name is required'),
  job: (schema) => schema.min(1, 'Job is required'),
});

export const selectBotSchema = createSelectSchema(bots);

export type InsertBot = z.infer<typeof insertBotSchema>;
export type SelectBot = z.infer<typeof selectBotSchema>;
