'use server';

import { auth } from '@clerk/nextjs/server';
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

    const validatedBot = insertBotSchema.parse({
      ...input,
      id: botId,
      userId,
      avatar: input.avatar || nanoid(),
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

