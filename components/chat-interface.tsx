"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import {
  useTriggerChatTransport,
  useLoadTranscript,
} from "@trigger.dev/sdk/chat/react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import {
  Suggestion,
  Suggestions,
} from "@/components/ai-elements/suggestion"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { ChatAvatar } from "@/components/chat-avatar"
import type { ChatWithMembers } from "@/queries/chats"
import type { chatAgent } from "@/trigger/chat"
import {
  mintChatAccessToken,
  startChatSession,
  loadChatTranscript,
} from "@/actions/chat"

interface ChatInterfaceProps {
  chat: ChatWithMembers
}

export function ChatInterface({ chat }: ChatInterfaceProps) {
  const bot = chat.members?.[0]?.bot ?? chat.bot ?? null
  const botName = chat.name || bot?.name || "AI Assistant"
  const avatarSeed = bot?.avatar || bot?.name || "Ada"
  const botJob = bot?.job

  const instructions = React.useMemo(() => {
    if (bot?.instructions) {
      return `You are ${bot.name}, whose role is: ${bot.job}.\n\nInstructions:\n${bot.instructions}`
    }
    if (bot) {
      return `You are ${bot.name}, whose role is: ${bot.job}.`
    }
    return undefined
  }, [bot])

  const clientData = React.useMemo(() => {
    return { instructions }
  }, [instructions])

  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    clientData,
  })

  const { messages: initialMessages, isLoading } = useLoadTranscript(
    chat.id,
    loadChatTranscript,
    { transport }
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background">
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center my-auto py-12 gap-4 text-center">
            <ChatAvatar
              seed={avatarSeed}
              alt={botName}
              className="size-16 rounded-full shadow-sm ring-2 ring-border/50 animate-pulse"
            />
            <div className="text-sm text-muted-foreground font-medium">
              <Shimmer>Loading conversation...</Shimmer>
            </div>
          </ConversationContent>
        </Conversation>
      </div>
    )
  }

  return (
    <ChatInner
      key={chat.id}
      chat={chat}
      initialMessages={initialMessages}
      transport={transport}
      botName={botName}
      avatarSeed={avatarSeed}
      botJob={botJob}
    />
  )
}

interface ChatInnerProps {
  chat: ChatWithMembers
  initialMessages: UIMessage[]
  transport: ReturnType<typeof useTriggerChatTransport<typeof chatAgent>>
  botName: string
  avatarSeed: string
  botJob?: string | null
}

function ChatInner({
  chat,
  initialMessages,
  transport,
  botName,
  avatarSeed,
  botJob,
}: ChatInnerProps) {
  const { messages, sendMessage, status, stop: aiStop, error, regenerate } = useChat({
    id: chat.id,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  })

  const handleStop = React.useCallback(() => {
    aiStop()
    transport.stopGeneration(chat.id)
  }, [aiStop, transport, chat.id])

  const handleSubmit = React.useCallback(
    ({ text }: { text: string }) => {
      const trimmed = text.trim()
      if (!trimmed) return
      sendMessage({ text: trimmed })
    },
    [sendMessage]
  )

  const handleSuggestionClick = React.useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion })
    },
    [sendMessage]
  )

  const suggestions = React.useMemo(() => {
    if (botJob) {
      return [
        `How can you help me as a ${botJob}?`,
        "What are your main capabilities?",
        "Give me a quick overview of your role",
      ]
    }
    return [
      "Hello! What can you help me with?",
      "Tell me a bit about what you can do",
      "Let's brainstorm some ideas together",
    ]
  }, [botJob])

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto py-12 gap-6 text-center">
              <ConversationEmptyState
                icon={
                  <ChatAvatar
                    seed={avatarSeed}
                    alt={botName}
                    className="size-16 rounded-full shadow-sm ring-2 ring-border/50"
                  />
                }
                title={`Chat with ${botName}`}
                description={
                  botJob
                    ? `${botJob} · Ready to assist you`
                    : "Ready to assist you with your questions"
                }
              />
              <Suggestions className="justify-center flex-wrap max-w-xl">
                {suggestions.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={handleSuggestionClick}
                  />
                ))}
              </Suggestions>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user"
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 w-full items-start ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isUser && (
                    <ChatAvatar
                      seed={avatarSeed}
                      alt={botName}
                      className="size-8 mt-1 shrink-0 rounded-full"
                    />
                  )}

                  <Message from={message.role} className="max-w-[85%]">
                    <MessageContent>
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case "text":
                            return (
                              <MessageResponse key={`${message.id}-${i}`}>
                                {part.text}
                              </MessageResponse>
                            )
                          default:
                            return null
                        }
                      })}
                    </MessageContent>
                  </Message>
                </div>
              )
            })
          )}

          {status === "submitted" && (
            <div className="flex gap-3 items-center text-sm text-muted-foreground">
              <ChatAvatar
                seed={avatarSeed}
                alt={botName}
                className="size-8 shrink-0 rounded-full"
              />
              <div className="rounded-lg bg-secondary/60 px-3.5 py-2 text-xs font-medium">
                <Shimmer>Thinking...</Shimmer>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
              <span>{error.message || "Failed to generate response."}</span>
              <button
                type="button"
                onClick={() => regenerate()}
                className="font-medium underline hover:no-underline ml-3 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-4 pt-0 shrink-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder={`Message ${botName}...`}
            className="min-h-16"
          />
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status={status} onStop={handleStop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export default ChatInterface
