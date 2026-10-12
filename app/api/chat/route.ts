import { auth } from '@clerk/nextjs/server';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const {
      messages,
      instructions,
    }: {
      messages: UIMessage[];
      instructions?: string;
    } = await req.json();

    const result = streamText({
      model: google('gemini-3.8-flash'),
      instructions: instructions || 'You are a helpful and intelligent AI assistant.',
      messages: await convertToModelMessages(messages),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(
      error?.message || 'Failed to process AI chat request.',
      { status: 500 }
    );
  }
}
