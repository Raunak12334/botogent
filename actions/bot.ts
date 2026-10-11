'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { bots, insertBotSchema, type Bot } from '@/lib/db/schema';
import { nanoid } from 'nanoid';

export type CreateBotInput = {
  name: string;
  job: string;
  instructions?: string | null;
  avatar?: string;
  sandboxId?: string | null;
};

export type CreateBotResult =
  | { success: true; data: Bot }
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
    const validated = insertBotSchema.parse({
      ...input,
      userId,
      avatar: input.avatar || nanoid(),
    });

    const [newBot] = await db.insert(bots).values(validated).returning();

    revalidatePath('/');

    return {
      success: true,
      data: newBot,
    };
  } catch (error) {
    console.error('Error creating bot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create bot',
    };
  }
}
