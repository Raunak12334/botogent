'use server';

import { auth } from '@clerk/nextjs/server';
import { auth as triggerAuth } from '@trigger.dev/sdk';
import { chat, defaultStorage } from '@trigger.dev/sdk/ai';
import { getChat } from '@/queries/chats';
import type { chatAgent, ChatAgentClientData } from '@/trigger/chat';

const baseStartChatSession = chat.createStartSessionAction<typeof chatAgent>('chat-agent');
const baseLoadTranscript = chat.createLoadTranscriptAction(defaultStorage, { limit: 50 });

/**
 * Creates or resumes a Trigger.dev chat session and returns a session public access token.
 * Authenticated and authorized against Clerk user and chat ID.
 * Automatically injects the bot's identity, job role, guidelines, and Daytona sandbox ID into clientData.
 */
export async function startChatSession(params: {
  chatId: string;
  clientData?: Partial<ChatAgentClientData>;
}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const existingChat = await getChat(params.chatId);
  if (!existingChat) {
    throw new Error('Chat not found or access denied');
  }

  const bot = existingChat.bot;

  const mergedClientData: ChatAgentClientData = {
    botName: bot?.name ?? params.clientData?.botName,
    botJob: bot?.job ?? params.clientData?.botJob,
    botInstructions: bot?.instructions ?? params.clientData?.botInstructions,
    sandboxId: bot?.sandboxId ?? params.clientData?.sandboxId,
    instructions: params.clientData?.instructions,
  };

  return baseStartChatSession({
    chatId: params.chatId,
    clientData: mergedClientData,
  });
}

/**
 * Mints a refreshed session-scoped public access token for the given chatId.
 * Authenticated and authorized against Clerk user and chat ID.
 */
export async function mintChatAccessToken(chatId: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const existingChat = await getChat(chatId);
  if (!existingChat) {
    throw new Error('Chat not found or access denied');
  }

  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: '1h',
  });
}

/**
 * Loads persisted transcript messages for the given chatId from transcript storage.
 * Authenticated and authorized against Clerk user and chat ID.
 */
export async function loadChatTranscript(params: {
  chatId: string;
  limit?: number;
  before?: string;
}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const existingChat = await getChat(params.chatId);
  if (!existingChat) {
    throw new Error('Chat not found or access denied');
  }

  return baseLoadTranscript(params);
}
