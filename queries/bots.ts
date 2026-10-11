import { auth } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bots, chats, type Bot, type Chat } from '@/lib/db/schema';

export type UserChat = Chat & {
  bot: Bot | null;
};

/**
 * Retrieves the chats for the currently authenticated Clerk user,
 * ordered by most recent activity.
 * Ignores group chat kind for now and falls back to the first bot member.
 */
export async function getUserChats(): Promise<UserChat[]> {
  const { userId } = await auth();

  if (!userId) {
    return [];
  }

  const userChats = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.lastMessageAt), desc(chats.createdAt)],
    with: {
      members: {
        with: {
          bot: true,
        },
      },
    },
  });

  return userChats.map((chat) => {
    // Ignore group chat kind for now, fall back to first bot
    const firstBot = chat.members[0]?.bot ?? null;

    return {
      id: chat.id,
      userId: chat.userId,
      kind: chat.kind,
      name: chat.name,
      lastMessagePreview: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt,
      createdAt: chat.createdAt,
      bot: firstBot,
    };
  });
}

/**
 * Retrieves all bots created by the currently authenticated Clerk user.
 */
export async function getUserBots(): Promise<Bot[]> {
  const { userId } = await auth();

  if (!userId) {
    return [];
  }

  return db
    .select()
    .from(bots)
    .where(eq(bots.userId, userId))
    .orderBy(desc(bots.createdAt));
}

// Aliases for convenience
export const getChats = getUserChats;
export const getBots = getUserBots;
