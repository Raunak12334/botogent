import { chat, defaultStorage } from "@trigger.dev/sdk/ai";
import { google } from "@ai-sdk/google";

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  run: async ({ messages, signal, streamText, clientData }) => {
    const instructions =
      (clientData as { instructions?: string } | undefined)?.instructions ||
      "You are a helpful and intelligent AI assistant.";

    return streamText({
      model: google("gemini-3.8-flash"),
      instructions,
      messages,
      abortSignal: signal,
    });
  },
});
