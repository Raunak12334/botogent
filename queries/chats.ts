import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  chats,
  type Bot,
  type Chat,
  type ChatMember,
} from '@/lib/db/schema';

export type ChatMemberWithBot = ChatMember & {
  bot: Bot;
};

export type ChatWithMembers = Chat & {
  bot: Bot | null;
  members: ChatMemberWithBot[];
  /** All member bots for the chat (convenience for group chats) */
  bots: Bot[];
};

/**
 * Retrieves a chat by its ID for the currently authenticated Clerk user.
 * Scoped to Clerk's user ID.
 * Populates members and all bots.
 */
export async function getChat(chatId: string): Promise<ChatWithMembers | null> {
  const { userId } = await auth();

  if (!userId || !chatId) {
    return null;
  }

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        with: {
          bot: true,
        },
      },
    },
  });

  if (!chat) {
    return null;
  }

  const memberBots = chat.members
    .map((m) => m.bot)
    .filter((b): b is Bot => b != null);
  const firstBot = memberBots[0] ?? null;

  return {
    ...chat,
    bot: firstBot,
    bots: memberBots,
  };
}

// Aliases for convenience
export const getChatById = getChat;
export { getUserChats, getChats, type UserChat } from './bots';
