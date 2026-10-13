'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  bots,
  chats,
  chatMembers,
  insertBotSchema,
  insertChatSchema,
  insertChatMemberSchema,
  type Bot,
  type Chat,
  type ChatMember,
} from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { createBotSandbox, deleteBotSandbox } from '@/lib/daytona';

export type CreateBotInput = {
  name: string;
  job: string;
  instructions?: string | null;
  avatar?: string;
  sandboxId?: string | null;
};

export type CreateBotData = {
  bot: Bot;
  chat: Chat;
  member: ChatMember;
};

export type CreateBotResult =
  | { success: true; data: CreateBotData }
  | { success: false; error: string };

export async function createBot(input: CreateBotInput): Promise<CreateBotResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      success: false,
      error: 'Unauthorized: You must be signed in to create a bot.',
    };
  }

  try {
    const botId = nanoid();
    const chatId = nanoid();

    // Create Daytona sandbox for this bot without starting/invoking code in it
    const sandbox = await createBotSandbox({
      botId,
      name: input.name,
      userId,
    });

    const validatedBot = insertBotSchema.parse({
      ...input,
      id: botId,
      userId,
      avatar: input.avatar || nanoid(),
      sandboxId: sandbox.id,
    });

    const validatedChat = insertChatSchema.parse({
      id: chatId,
      userId,
      kind: 'direct',
      name: null,
      lastMessagePreview: null,
    });

    const validatedMember = insertChatMemberSchema.parse({
      chatId,
      botId,
    });

    const [botResults, chatResults, memberResults] = await db.batch([
      db.insert(bots).values(validatedBot).returning(),
      db.insert(chats).values(validatedChat).returning(),
      db.insert(chatMembers).values(validatedMember).returning(),
    ]);

    const newBot = botResults[0];
    const newChat = chatResults[0];
    const newMember = memberResults[0];

    revalidatePath('/');

    return {
      success: true,
      data: {
        bot: newBot,
        chat: newChat,
        member: newMember,
      },
    };
  } catch (error) {
    console.error('Error creating bot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create bot',
    };
  }
}

export type DeleteBotResult =
  | { success: true; data: { botId: string } }
  | { success: false; error: string };

export async function deleteBot(botId: string): Promise<DeleteBotResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      success: false,
      error: 'Unauthorized: You must be signed in to delete a bot.',
    };
  }

  try {
    // Verify bot belongs to authenticated user
    const existingBot = await db.query.bots.findFirst({
      where: and(eq(bots.id, botId), eq(bots.userId, userId)),
    });

    if (!existingBot) {
      return {
        success: false,
        error: 'Bot not found or unauthorized.',
      };
    }

    // Delete associated Daytona sandbox if exists
    if (existingBot.sandboxId) {
      await deleteBotSandbox(existingBot.sandboxId);
    }

    // Find direct chats where this bot is a member to clean them up
    const memberships = await db.query.chatMembers.findMany({
      where: eq(chatMembers.botId, botId),
      with: {
        chat: true,
      },
    });

    const directChatIdsToDelete = memberships
      .filter((m) => m.chat && m.chat.kind === 'direct' && m.chat.userId === userId)
      .map((m) => m.chatId);

    // Delete bot (cascades to chatMembers)
    await db.delete(bots).where(and(eq(bots.id, botId), eq(bots.userId, userId)));

    // Clean up direct chats associated with this bot
    if (directChatIdsToDelete.length > 0) {
      await db.delete(chats).where(inArray(chats.id, directChatIdsToDelete));
    }

    revalidatePath('/');
    revalidatePath('/chats');

    return {
      success: true,
      data: { botId },
    };
  } catch (error) {
    console.error('Error deleting bot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete bot',
    };
  }
}


