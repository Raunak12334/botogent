'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  bots,
  chats,
  chatMembers,
  insertChatSchema,
  insertChatMemberSchema,
  type Chat,
  type ChatMember,
  type Bot,
} from '@/lib/db/schema';
import { nanoid } from 'nanoid';

export type CreateGroupChatInput = {
  name: string;
  botIds: string[];
};

export type CreateGroupChatData = {
  chat: Chat;
  members: ChatMember[];
};

export type CreateGroupChatResult =
  | { success: true; data: CreateGroupChatData }
  | { success: false; error: string };

export async function createGroupChat(
  input: CreateGroupChatInput
): Promise<CreateGroupChatResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      success: false,
      error: 'Unauthorized: You must be signed in to create a group chat.',
    };
  }

  if (!input.name?.trim()) {
    return { success: false, error: 'Group name is required.' };
  }

  if (!input.botIds || input.botIds.length < 2) {
    return { success: false, error: 'Select at least 2 bots for a group chat.' };
  }

  try {
    // Verify all bots belong to the authenticated user
    const userBots = await db
      .select()
      .from(bots)
      .where(inArray(bots.id, input.botIds));

    const ownedBots = userBots.filter((b) => b.userId === userId);
    if (ownedBots.length !== input.botIds.length) {
      return {
        success: false,
        error: 'One or more selected bots were not found.',
      };
    }

    const chatId = nanoid();

    const validatedChat = insertChatSchema.parse({
      id: chatId,
      userId,
      kind: 'group',
      name: input.name.trim(),
      lastMessagePreview: null,
    });

    const validatedMembers = input.botIds.map((botId) =>
      insertChatMemberSchema.parse({ chatId, botId })
    );

    const [chatResults] = await db.batch([
      db.insert(chats).values(validatedChat).returning(),
      ...validatedMembers.map((m) =>
        db.insert(chatMembers).values(m).returning()
      ),
    ]);

    const newChat = chatResults[0];

    revalidatePath('/');

    return {
      success: true,
      data: {
        chat: newChat,
        members: validatedMembers as ChatMember[],
      },
    };
  } catch (error) {
    console.error('Error creating group chat:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create group chat',
    };
  }
}
