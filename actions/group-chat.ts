'use server';

import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
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
    revalidatePath('/chats');

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

export type UpdateGroupChatInput = {
  chatId: string;
  name: string;
  botIds: string[];
};

export type UpdateGroupChatData = {
  chat: Chat;
  members: ChatMember[];
};

export type UpdateGroupChatResult =
  | { success: true; data: UpdateGroupChatData }
  | { success: false; error: string };

export async function updateGroupChat(
  input: UpdateGroupChatInput
): Promise<UpdateGroupChatResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      success: false,
      error: 'Unauthorized: You must be signed in to edit a group chat.',
    };
  }

  if (!input.chatId) {
    return { success: false, error: 'Chat ID is required.' };
  }

  if (!input.name?.trim()) {
    return { success: false, error: 'Group name is required.' };
  }

  if (!input.botIds || input.botIds.length < 2) {
    return { success: false, error: 'Select at least 2 bots for a group chat.' };
  }

  try {
    // Verify group chat exists and belongs to this user
    const existingChat = await db.query.chats.findFirst({
      where: and(eq(chats.id, input.chatId), eq(chats.userId, userId)),
    });

    if (!existingChat) {
      return { success: false, error: 'Group chat not found or access denied.' };
    }

    if (existingChat.kind !== 'group') {
      return { success: false, error: 'Only group chats can be modified with this action.' };
    }

    // Verify all selected bots belong to the user
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

    // Update group chat name
    const [updatedChat] = await db
      .update(chats)
      .set({ name: input.name.trim() })
      .where(and(eq(chats.id, input.chatId), eq(chats.userId, userId)))
      .returning();

    // Sync member bots: find current members and compute additions / deletions
    const currentMembers = await db
      .select()
      .from(chatMembers)
      .where(eq(chatMembers.chatId, input.chatId));

    const currentBotIds = new Set(currentMembers.map((m) => m.botId));
    const targetBotIds = new Set(input.botIds);

    const botIdsToRemove = currentMembers
      .filter((m) => !targetBotIds.has(m.botId))
      .map((m) => m.botId);

    const botIdsToAdd = input.botIds.filter((id) => !currentBotIds.has(id));

    if (botIdsToRemove.length > 0) {
      await db
        .delete(chatMembers)
        .where(
          and(
            eq(chatMembers.chatId, input.chatId),
            inArray(chatMembers.botId, botIdsToRemove)
          )
        );
    }

    if (botIdsToAdd.length > 0) {
      const newMembers = botIdsToAdd.map((botId) =>
        insertChatMemberSchema.parse({
          chatId: input.chatId,
          botId,
        })
      );
      await db.insert(chatMembers).values(newMembers);
    }

    const allMembers = await db
      .select()
      .from(chatMembers)
      .where(eq(chatMembers.chatId, input.chatId));

    revalidatePath('/');
    revalidatePath('/chats');
    revalidatePath(`/chats/${input.chatId}`);

    return {
      success: true,
      data: {
        chat: updatedChat,
        members: allMembers,
      },
    };
  } catch (error) {
    console.error('Error updating group chat:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update group chat',
    };
  }
}

export type DeleteGroupChatResult =
  | { success: true; data: { chatId: string } }
  | { success: false; error: string };

export async function deleteGroupChat(chatId: string): Promise<DeleteGroupChatResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      success: false,
      error: 'Unauthorized: You must be signed in to delete a group chat.',
    };
  }

  if (!chatId) {
    return { success: false, error: 'Chat ID is required.' };
  }

  try {
    const existingChat = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    });

    if (!existingChat) {
      return { success: false, error: 'Group chat not found or access denied.' };
    }

    if (existingChat.kind !== 'group') {
      return { success: false, error: 'Only group chats can be deleted with this action.' };
    }

    // Delete the group chat. Note: foreign keys on chatMembers cascade automatically.
    // Individual bots and their sandboxes remain untouched.
    await db
      .delete(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));

    revalidatePath('/');
    revalidatePath('/chats');

    return {
      success: true,
      data: { chatId },
    };
  } catch (error) {
    console.error('Error deleting group chat:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete group chat',
    };
  }
}

export async function getAvailableBots(): Promise<Bot[]> {
  const { userId } = await auth();
  if (!userId) return [];
  return db
    .select()
    .from(bots)
    .where(eq(bots.userId, userId))
    .orderBy(desc(bots.createdAt));
}

