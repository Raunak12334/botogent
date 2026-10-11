import { relations } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const chatKindEnum = pgEnum('chat_kind', ['direct', 'group']);

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

export const chats = pgTable(
  'chats',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id').notNull(),
    kind: chatKindEnum('kind').notNull().default('direct'),
    name: text('name'),
    lastMessagePreview: text('last_message_preview'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('chats_user_id_idx').on(table.userId)]
);

export const chatMembers = pgTable(
  'chat_members',
  {
    chatId: text('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    botId: text('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index('chat_members_bot_id_idx').on(table.botId),
  ]
);

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
}));

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}));

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  bot: one(bots, {
    fields: [chatMembers.botId],
    references: [bots.id],
  }),
}));

export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;

export const insertBotSchema = createInsertSchema(bots, {
  name: (schema) => schema.min(1, 'Name is required'),
  job: (schema) => schema.min(1, 'Job is required'),
});

export const selectBotSchema = createSelectSchema(bots);

export type InsertBot = z.infer<typeof insertBotSchema>;
export type SelectBot = z.infer<typeof selectBotSchema>;

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;

export const insertChatSchema = createInsertSchema(chats);
export const selectChatSchema = createSelectSchema(chats);

export type InsertChat = z.infer<typeof insertChatSchema>;
export type SelectChat = z.infer<typeof selectChatSchema>;

export type ChatMember = typeof chatMembers.$inferSelect;
export type NewChatMember = typeof chatMembers.$inferInsert;

export const insertChatMemberSchema = createInsertSchema(chatMembers);
export const selectChatMemberSchema = createSelectSchema(chatMembers);

export type InsertChatMember = z.infer<typeof insertChatMemberSchema>;
export type SelectChatMember = z.infer<typeof selectChatMemberSchema>;
