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
};

/**
 * Retrieves a chat by its ID for the currently authenticated Clerk user.
 * Scoped to Clerk's user ID.
 * Populates members and falls back to the first bot member.
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

  const firstBot = chat.members[0]?.bot ?? null;

  return {
    ...chat,
    bot: firstBot,
  };
}

// Aliases for convenience
export const getChatById = getChat;
export { getUserChats, getChats, type UserChat } from './bots';
