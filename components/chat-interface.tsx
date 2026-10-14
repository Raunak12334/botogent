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
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
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
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { cn } from "@/lib/utils"
import type { ChatWithMembers } from "@/queries/chats"
import type { chatAgent, ChatAgentClientData } from "@/trigger/chat"
import type { Bot } from "@/lib/db/schema"
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
  const isGroup =
    chat.kind === "group" ||
    (chat.bots && chat.bots.length > 1) ||
    (chat.members && chat.members.length > 1)

  const chatBots = React.useMemo<Bot[]>(() => {
    if (chat.bots && chat.bots.length > 0) return chat.bots
    if (chat.members && chat.members.length > 0) {
      return chat.members.map((m) => m.bot).filter((b): b is Bot => b != null)
    }
    return chat.bot ? [chat.bot] : []
  }, [chat])

  const [selectedBotId, setSelectedBotId] = React.useState<string>(
    () => chatBots[0]?.id || chat.bot?.id || ""
  )

  React.useEffect(() => {
    if (chatBots.length > 0 && !chatBots.some((b) => b.id === selectedBotId)) {
      setSelectedBotId(chatBots[0].id)
    }
  }, [chatBots, selectedBotId])

  const currentBot = React.useMemo(() => {
    return chatBots.find((b) => b.id === selectedBotId) ?? chatBots[0] ?? chat.bot ?? null
  }, [chatBots, selectedBotId, chat.bot])

  const botName = isGroup
    ? chat.name || "Group Chat"
    : (currentBot?.name || chat.name || "AI Assistant")
  const avatarSeed = currentBot?.avatar || currentBot?.name || "Ada"
  const botJob = currentBot?.job

  const clientData = React.useMemo<ChatAgentClientData>(() => {
    return {
      botId: currentBot?.id,
      botName: currentBot?.name || "AI Assistant",
      botJob: currentBot?.job,
      botInstructions: currentBot?.instructions,
      sandboxId: currentBot?.sandboxId,
    }
  }, [currentBot])

  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData: sessionClientData }) =>
      startChatSession({
        chatId,
        clientData: {
          ...clientData,
          ...sessionClientData,
        },
      }),
    clientData,
  })

  const { messages: initialMessages, isLoading } = useLoadTranscript(
    chat.id,
    loadChatTranscript,
    { transport }
  )

  if (isLoading) {
    const groupSeeds = chatBots.map((b) => b.avatar || b.name)
    return (
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background">
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center my-auto py-12 gap-4 text-center">
            {isGroup && groupSeeds.length > 1 ? (
              <GroupChatAvatar
                seeds={groupSeeds}
                sizeClassName="size-16"
                className="rounded-full shadow-sm ring-2 ring-border/50 animate-pulse"
              />
            ) : (
              <ChatAvatar
                seed={avatarSeed}
                alt={botName}
                className="size-16 rounded-full shadow-sm ring-2 ring-border/50 animate-pulse"
              />
            )}
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
      isGroup={isGroup}
      chatBots={chatBots}
      selectedBotId={selectedBotId}
      onSelectBotId={setSelectedBotId}
      currentBot={currentBot}
      botName={botName}
      avatarSeed={avatarSeed}
      botJob={botJob}
      clientData={clientData}
    />
  )
}

interface ChatInnerProps {
  chat: ChatWithMembers
  initialMessages: UIMessage[]
  transport: ReturnType<typeof useTriggerChatTransport<typeof chatAgent>>
  isGroup: boolean
  chatBots: Bot[]
  selectedBotId: string
  onSelectBotId: (id: string) => void
  currentBot: Bot | null
  botName: string
  avatarSeed: string
  botJob?: string | null
  clientData: ChatAgentClientData
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
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-100 shadow-inner">
            <div className="flex items-center gap-2 text-neutral-400 mb-2 border-b border-neutral-800 pb-1.5">
              <TerminalIcon className="size-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-neutral-200">Terminal</span>
              {exitCode !== undefined && (
                <span
                  className={cn(
                    "ml-auto text-[10px] px-1.5 py-0.5 rounded",
                    exitCode === 0
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-rose-950 text-rose-400 border border-rose-800"
                  )}
                >
                  exit {exitCode}
                </span>
              )}
            </div>
            <div className="flex gap-2 text-neutral-300 font-semibold mb-2">
              <span className="text-emerald-400 select-none">$</span>
              <span className="break-all">{command}</span>
            </div>
            {stdout && (
              <pre className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-neutral-900/70 p-2 text-[11px] text-neutral-300">
                {stdout}
              </pre>
            )}
            {part.errorText && (
              <div className="mt-2 rounded bg-rose-950/60 border border-rose-800/80 p-2 text-[11px] text-rose-300">
                {part.errorText}
              </div>
            )}
          </div>
        </ToolContent>
      </Tool>
    )
  }

  // showScreen — render user-visible screenshot directly in chat
  if (toolName === "showScreen") {
    const caption = typeof input.caption === "string" ? input.caption : undefined
    const outputData = output as { imageUrl?: string; base64?: string; mimeType?: string } | undefined
    const imageSrc =
      outputData?.imageUrl ||
      (outputData?.base64
        ? `data:${outputData.mimeType || "image/png"};base64,${outputData.base64}`
        : undefined)

    return (
      <Tool key={key} defaultOpen>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={caption || "Desktop Screenshot"}
          toolName="showScreen"
        />
        <ToolContent>
          <div className="space-y-2">
            {imageSrc ? (
              <div className="overflow-hidden rounded-lg border border-border bg-neutral-950 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt={caption || "Desktop Screenshot"}
                  className="w-full h-auto object-contain max-h-[480px]"
                />
                {caption && (
                  <div className="px-3 py-1.5 text-xs text-neutral-400 bg-neutral-900 border-t border-neutral-800 flex items-center gap-1.5">
                    <MonitorIcon className="size-3.5 text-primary shrink-0" />
                    <span>{caption}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground bg-muted/30 rounded-md">
                <MonitorIcon className="size-4 shrink-0 text-primary/70 animate-pulse" />
                <span>Capturing screenshot...</span>
              </div>
            )}
            {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
          </div>
        </ToolContent>
      </Tool>
    )
  }

  // readFile
  if (toolName === "readFile") {
    const path = String(input.path ?? "")
    const content = output ? String((output as { content?: string }).content ?? "") : undefined
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={path ? `Read ${path}` : "Read file"}
          toolName="readFile"
        />
        <ToolContent>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileTextIcon className="size-3.5 shrink-0" />
              <code className="text-[11px] font-mono">{path}</code>
            </div>
            {content !== undefined && (
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[11px] text-foreground border border-border/50">
                {content}
              </pre>
            )}
            {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
          </div>
        </ToolContent>
      </Tool>
    )
  }

  // writeFile
  if (toolName === "writeFile") {
    const path = String(input.path ?? "")
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={path ? `Write ${path}` : "Write file"}
          toolName="writeFile"
        />
        <ToolContent>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PencilIcon className="size-3.5 shrink-0 text-emerald-500" />
              <code className="text-[11px] font-mono">{path}</code>
              {state === "output-available" && (
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                  <CheckIcon className="size-3" /> saved
                </span>
              )}
            </div>
            {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
          </div>
        </ToolContent>
      </Tool>
    )
  }

  // listFiles
  if (toolName === "listFiles") {
    const path = String(input.path ?? ".")
    const entries = output ? (output as { entries?: Array<{ name: string; isDir?: boolean }> }).entries : undefined
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={path ? `List ${path}` : "List directory"}
          toolName="listFiles"
        />
        <ToolContent>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderIcon className="size-3.5 shrink-0 text-amber-500" />
              <code className="text-[11px] font-mono">{path}</code>
            </div>
            {entries && (
              <div className="grid grid-cols-2 gap-1 rounded bg-muted/40 p-2 font-mono text-[11px] text-foreground border border-border/50">
                {entries.map((e, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 truncate">
                    {e.isDir ? (
                      <FolderIcon className="size-3 text-amber-500 shrink-0" />
                    ) : (
                      <FileTextIcon className="size-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{e.name}</span>
                  </div>
                ))}
              </div>
            )}
            {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
          </div>
        </ToolContent>
      </Tool>
    )
  }

  // mouseClick
  if (toolName === "mouseClick") {
    const x = input.x !== undefined ? String(input.x) : "?"
    const y = input.y !== undefined ? String(input.y) : "?"
    const button = input.button ? ` (${input.button})` : ""
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={`Click at (${x}, ${y})${button}`}
          toolName="mouseClick"
        />
        <ToolContent>
          <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground bg-muted/20 rounded">
            <MousePointerIcon className="size-3.5 text-primary" />
            <span>Mouse clicked at coordinates ({x}, {y})</span>
          </div>
          {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
        </ToolContent>
      </Tool>
    )
  }

  // mouseMove
  if (toolName === "mouseMove") {
    const x = input.x !== undefined ? String(input.x) : "?"
    const y = input.y !== undefined ? String(input.y) : "?"
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={`Move mouse to (${x}, ${y})`}
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
    const dy = input.dy !== undefined ? String(input.dy) : "?"
    return (
      <Tool key={key}>
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={`Scroll mouse (${dy})`}
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
          title={text.length > 40 ? `Type "${text.slice(0, 40)}…"` : `Type "${text}"`}
          toolName="keyboardType"
        />
        <ToolContent>
          <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground bg-muted/20 rounded font-mono">
            <KeyboardIcon className="size-3.5 text-primary shrink-0" />
            <span className="truncate">Typed: &ldquo;{text}&rdquo;</span>
          </div>
          {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
        </ToolContent>
      </Tool>
    )
  }

  // keyboardPress
  if (toolName === "keyboardPress") {
    const keyLabel = String(input.key ?? "key")
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
  isGroup,
  chatBots,
  selectedBotId,
  onSelectBotId,
  currentBot,
  botName,
  avatarSeed,
  botJob,
  clientData,
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
      sendMessage(
        { text: trimmed },
        {
          metadata: {
            botId: currentBot?.id,
            botName: currentBot?.name,
            botJob: currentBot?.job,
            botInstructions: currentBot?.instructions,
            sandboxId: currentBot?.sandboxId,
          },
        }
      )
    },
    [sendMessage, currentBot]
  )

  const handleSuggestionClick = React.useCallback(
    (suggestion: string) => {
      sendMessage(
        { text: suggestion },
        {
          metadata: {
            botId: currentBot?.id,
            botName: currentBot?.name,
            botJob: currentBot?.job,
            botInstructions: currentBot?.instructions,
            sandboxId: currentBot?.sandboxId,
          },
        }
      )
    },
    [sendMessage, currentBot]
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
                  isGroup && chatBots.length > 1 ? (
                    <GroupChatAvatar
                      seeds={chatBots.map((b) => b.avatar || b.name)}
                      sizeClassName="size-16"
                      className="rounded-full shadow-sm ring-2 ring-border/50"
                    />
                  ) : (
                    <ChatAvatar
                      seed={avatarSeed}
                      alt={botName}
                      className="size-16 rounded-full shadow-sm ring-2 ring-border/50"
                    />
                  )
                }
                title={isGroup ? (chat.name || "Group Chat") : `Chat with ${botName}`}
                description={
                  isGroup
                    ? `Group chat with ${chatBots.map((b) => b.name).join(", ")}`
                    : botJob
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
                      seed={currentBot?.avatar || currentBot?.name || avatarSeed}
                      alt={currentBot?.name || botName}
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
                seed={currentBot?.avatar || currentBot?.name || avatarSeed}
                alt={currentBot?.name || botName}
                className="size-8 shrink-0 rounded-full"
              />
              <div className="rounded-lg bg-secondary/60 px-3.5 py-2 text-xs font-medium">
                <Shimmer>
                  {currentBot ? `${currentBot.name} is thinking...` : "Thinking..."}
                </Shimmer>
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
            placeholder={
              isGroup && currentBot
                ? `Message ${currentBot.name}...`
                : `Message ${botName}...`
            }
            className="min-h-16"
          />
          <PromptInputFooter>
            <PromptInputTools>
              {isGroup && chatBots.length > 0 && (
                <PromptInputSelect
                  value={selectedBotId}
                  onValueChange={(val) => {
                    if (typeof val === "string") onSelectBotId(val)
                  }}
                >
                  <PromptInputSelectTrigger className="h-8 gap-2 rounded-md border border-input/40 bg-muted/30 px-2.5 py-1 text-xs hover:bg-muted/60 transition-colors">
                    <ChatAvatar
                      seed={currentBot?.avatar || currentBot?.name || "Ada"}
                      className="size-4 shrink-0 rounded-full"
                    />
                    <span className="truncate max-w-[120px] font-medium text-foreground">
                      {currentBot?.name || "Select bot"}
                    </span>
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent align="start" className="min-w-44">
                    {chatBots.map((b) => (
                      <PromptInputSelectItem
                        key={b.id}
                        value={b.id}
                        className="cursor-pointer gap-2 py-1.5 text-xs"
                      >
                        <ChatAvatar
                          seed={b.avatar || b.name}
                          className="size-5 shrink-0 rounded-full"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium text-foreground">
                            {b.name}
                          </span>
                          {b.job && (
                            <span className="truncate text-[10px] text-muted-foreground">
                              {b.job}
                            </span>
                          )}
                        </div>
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              )}
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={handleStop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export default ChatInterface
