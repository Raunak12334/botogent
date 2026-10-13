"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { isToolUIPart, type UIMessage } from "ai"
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
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import {
  Terminal,
  TerminalHeader,
  TerminalTitle,
  TerminalContent as TerminalBody,
} from "@/components/ai-elements/terminal"
import { ChatAvatar } from "@/components/chat-avatar"
import type { ChatWithMembers } from "@/queries/chats"
import type { chatAgent, ChatAgentClientData } from "@/trigger/chat"
import {
  mintChatAccessToken,
  startChatSession,
  loadChatTranscript,
} from "@/actions/chat"
import {
  TerminalIcon,
  FileTextIcon,
  FolderIcon,
  MousePointerIcon,
  MoveIcon,
  ScrollIcon,
  KeyboardIcon,
  MonitorIcon,
  PencilIcon,
  CheckIcon,
} from "lucide-react"

interface ChatInterfaceProps {
  chat: ChatWithMembers
}

export function ChatInterface({ chat }: ChatInterfaceProps) {
  const bot = chat.members?.[0]?.bot ?? chat.bot ?? null
  const botName = chat.name || bot?.name || "AI Assistant"
  const avatarSeed = bot?.avatar || bot?.name || "Ada"
  const botJob = bot?.job

  const clientData = React.useMemo<ChatAgentClientData>(() => {
    return {
      botName: bot?.name || botName,
      botJob: bot?.job,
      botInstructions: bot?.instructions,
      sandboxId: bot?.sandboxId,
    }
  }, [bot, botName])

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

// ---------------------------------------------------------------------------
// Tool-call rendering helpers
// ---------------------------------------------------------------------------

type ToolPartLike = {
  type: string
  toolName?: string
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-denied"
    | "output-error"
  input?: Record<string, unknown>
  output?: unknown
  errorText?: string
}

function renderToolPart(part: ToolPartLike, key: string) {
  const toolName =
    part.toolName ??
    (part.type === "dynamic-tool" ? "tool" : part.type.replace(/^tool-/, ""))
  const state = part.state
  const input = (part.input ?? {}) as Record<string, unknown>
  const output = part.output as Record<string, unknown> | undefined

  // viewScreen — show status in chat without raw vision image
  if (toolName === "viewScreen") {
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title="Look at the screen"
          toolName="viewScreen"
        />
        <ToolContent>
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground bg-muted/30 rounded-md">
            <MonitorIcon className="size-4 shrink-0 text-primary/70" />
            <span>Screen captured and inspected for visual analysis</span>
          </div>
          {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
        </ToolContent>
      </Tool>
    )
  }

  // bash — terminal-style
  if (toolName === "bash") {
    const command = String(input.command ?? "")
    const stdout = output ? String((output as { stdout?: string }).stdout ?? "") : undefined
    const exitCode = output ? (output as { exitCode?: number }).exitCode : undefined
    return (
      <Tool key={key} defaultOpen>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={command.length > 60 ? command.slice(0, 60) + "…" : command}
          toolName="bash"
        />
        <ToolContent>
          <Terminal output={stdout ?? ""} isStreaming={state === "input-available"}>
            <TerminalHeader>
              <TerminalTitle>$ {command}</TerminalTitle>
              {exitCode !== undefined && (
                <span className={`text-xs font-mono ${exitCode === 0 ? "text-green-400" : "text-red-400"}`}>
                  exit {exitCode}
                </span>
              )}
            </TerminalHeader>
            <TerminalBody />
          </Terminal>
          {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
        </ToolContent>
      </Tool>
    )
  }

  // showScreen — render the screenshot inline
  if (toolName === "showScreen") {
    const dataUri = output ? (output as { dataUri?: string }).dataUri : undefined
    const caption = output ? (output as { caption?: string }).caption : undefined
    return (
      <Tool key={key} defaultOpen>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={caption ?? "Screen"}
          toolName="showScreen"
        />
        <ToolContent>
          {dataUri ? (
            <div className="space-y-2">
              <img
                src={dataUri}
                alt={caption ?? "Sandbox screen"}
                className="w-full rounded-md border border-border/50 shadow-sm"
              />
              {caption && (
                <p className="text-xs text-muted-foreground text-center">{caption}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Screenshot unavailable</p>
          )}
          {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
        </ToolContent>
      </Tool>
    )
  }

  // readFile
  if (toolName === "readFile") {
    const filePath = String(input.path ?? "")
    const content = output ? (output as { content?: string }).content : undefined
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={filePath}
          toolName="readFile"
        />
        <ToolContent>
          {content !== undefined ? (
            <div className="space-y-2">
              <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {filePath}
              </h4>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap">
                {content}
              </pre>
            </div>
          ) : (
            <ToolInput input={input} />
          )}
          <ToolOutput output={output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    )
  }

  // writeFile
  if (toolName === "writeFile") {
    const filePath = String(input.path ?? "")
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={filePath}
          toolName="writeFile"
        />
        <ToolContent>
          <ToolInput input={{ path: filePath, content: input.content }} />
          <ToolOutput output={output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    )
  }

  // listFiles
  if (toolName === "listFiles") {
    const dirPath = String(input.path ?? "/home/daytona")
    const entries = output
      ? (output as { entries?: { name: string; type: string; size?: number }[] }).entries ?? []
      : []
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={dirPath}
          toolName="listFiles"
        />
        <ToolContent>
          {entries.length > 0 ? (
            <div className="rounded-md border border-border/50 divide-y divide-border/30 overflow-hidden text-xs font-mono">
              {entries.map((e) => (
                <div key={e.name} className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 hover:bg-muted/60 transition-colors">
                  {e.type === "directory" ? (
                    <FolderIcon className="size-3.5 text-blue-500 shrink-0" />
                  ) : (
                    <FileTextIcon className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span>{e.name}</span>
                  {e.size !== undefined && (
                    <span className="ml-auto text-muted-foreground">
                      {e.size < 1024 ? `${e.size}B` : `${(e.size / 1024).toFixed(1)}KB`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <ToolInput input={input} />
          )}
          <ToolOutput output={output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    )
  }

  // mouseClick
  if (toolName === "mouseClick") {
    const { x, y, button = "left", double: dbl } = input as { x: number; y: number; button?: string; double?: boolean }
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={`${dbl ? "double-" : ""}${button} click at (${x}, ${y})`}
          toolName="mouseClick"
        />
        <ToolContent>
          <ToolInput input={{ x, y, button, double: dbl }} />
          <ToolOutput output={output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    )
  }

  // mouseMove
  if (toolName === "mouseMove") {
    const { x, y } = input as { x: number; y: number }
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={`Move to (${x}, ${y})`}
          toolName="mouseMove"
        />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput output={output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    )
  }

  // mouseScroll
  if (toolName === "mouseScroll") {
    const { x, y, direction, amount } = input as { x: number; y: number; direction: string; amount: number }
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={`Scroll ${direction} ×${amount} at (${x}, ${y})`}
          toolName="mouseScroll"
        />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput output={output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    )
  }

  // keyboardType
  if (toolName === "keyboardType") {
    const text = String(input.text ?? "")
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={text.length > 50 ? `"${text.slice(0, 50)}…"` : `"${text}"`}
          toolName="keyboardType"
        />
        <ToolContent>
          <ToolInput input={{ text }} />
          <ToolOutput output={output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    )
  }

  // keyboardPress
  if (toolName === "keyboardPress") {
    const keyLabel = String(input.hotkey ?? input.key ?? "")
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={keyLabel}
          toolName="keyboardPress"
        />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput output={output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    )
  }

  // Generic fallback
  return (
    <Tool key={key}>
      <ToolHeader
        type="dynamic-tool"
        state={state}
        toolName={toolName ?? "tool"}
      />
      <ToolContent>
        <ToolInput input={input} />
        <ToolOutput output={output} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  )
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
                        const partKey = `${message.id}-${i}`
                        if (part.type === "text") {
                          return (
                            <MessageResponse key={partKey}>
                              {part.text}
                            </MessageResponse>
                          )
                        }
                        if (isToolUIPart(part)) {
                          const toolName =
                            "toolName" in part && typeof part.toolName === "string"
                              ? part.toolName
                              : part.type.replace(/^tool-/, "")
                          return renderToolPart(
                            {
                              type: part.type,
                              toolName,
                              state: part.state,
                              input: (part.input as Record<string, unknown>) ?? {},
                              output: "output" in part ? part.output : undefined,
                              errorText:
                                "errorText" in part
                                  ? (part.errorText as string)
                                  : undefined,
                            },
                            partKey
                          )
                        }
                        return null
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
