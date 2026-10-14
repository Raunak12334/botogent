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
  ArrowRightIcon,
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
      isGroup,
      chatName: chat.name || (isGroup ? "Group Chat" : currentBot?.name || "AI Assistant"),
      availableBots: chatBots.map((b) => ({
        id: b.id,
        name: b.name,
        job: b.job,
        instructions: b.instructions,
        avatar: b.avatar,
        sandboxId: b.sandboxId,
      })),
    }
  }, [currentBot, isGroup, chat.name, chatBots])

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

  // handOff — group chat delegation
  if (toolName === "handOff") {
    const outputData = output as
      | {
          targetBotId?: string
          targetBotName?: string
          targetBotJob?: string
          targetBotAvatar?: string
          fromBotName?: string
          reason?: string
          context?: string
        }
      | undefined

    const targetName =
      outputData?.targetBotName ||
      (typeof input.targetBotName === "string" ? input.targetBotName : "Teammate")
    const targetJob = outputData?.targetBotJob
    const fromName = outputData?.fromBotName
    const reason =
      outputData?.reason ||
      (typeof input.reason === "string" ? input.reason : "")
    const targetAvatar = outputData?.targetBotAvatar || targetName

    return (
      <Tool key={key} defaultOpen className="overflow-hidden border-primary/20 bg-primary/5">
        <ToolHeader
          type="dynamic-tool"
          state={state}
          title={`Handing off to ${targetName}`}
          toolName="handOff"
        />
        <ToolContent>
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3.5 shadow-xs">
            <div className="flex items-center gap-3">
              {fromName && (
                <>
                  <div className="flex items-center gap-2">
                    <ChatAvatar seed={fromName} className="size-6 rounded-full" />
                    <span className="text-xs font-semibold text-foreground/80">{fromName}</span>
                  </div>
                  <ArrowRightIcon className="size-4 text-primary shrink-0" />
                </>
              )}
              <div className="flex items-center gap-2.5">
                <ChatAvatar
                  seed={targetAvatar}
                  alt={targetName}
                  className="size-7 rounded-full shadow-xs ring-1 ring-primary/40"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">{targetName}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Assigned
                    </span>
                  </div>
                  {targetJob && (
                    <span className="text-[11px] text-muted-foreground">{targetJob}</span>
                  )}
                </div>
              </div>
            </div>

            {reason && (
              <div className="rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/40">
                <div className="font-semibold text-foreground mb-0.5 text-[11px]">Reason for hand-off:</div>
                <p className="italic text-foreground/90">{reason}</p>
              </div>
            )}

            {state === "output-available" && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckIcon className="size-3.5" />
                <span>Hand-off confirmed. {targetName} is ready to continue.</span>
              </div>
            )}
            {part.errorText && <ToolOutput output={output} errorText={part.errorText} />}
          </div>
        </ToolContent>
      </Tool>
    )
  }

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

function getBotForMessage(
  message: UIMessage,
  index: number,
  allMessages: UIMessage[],
  chatBots: Bot[],
  isGroup: boolean,
  activeStreamingBot?: Bot | null
): Bot | null {
  if (chatBots.length === 0) return null
  if (!isGroup) return chatBots[0] ?? null

  // 1. Check data-bot part in message.parts
  const botPart = message.parts.find(
    (p) =>
      p.type === "data-bot" ||
      ((p.type as string) === "data" &&
        (p as { data?: { type?: string; botId?: string; botName?: string } }).data?.type === "data-bot")
  ) as
    | { type: string; data?: { botId?: string; botName?: string } }
    | undefined

  let botId = botPart?.data?.botId
  let botName = botPart?.data?.botName

  // 2. Check direct metadata on message
  const msgMetadata = (message as { metadata?: { botId?: string; botName?: string } }).metadata
  if (!botId && msgMetadata?.botId) botId = msgMetadata.botId
  if (!botName && msgMetadata?.botName) botName = msgMetadata.botName

  // 3. Match against chatBots if botId or botName is found
  if (botId) {
    const matched = chatBots.find((b) => b.id === botId)
    if (matched) return matched
  }
  if (botName) {
    const matched = chatBots.find(
      (b) => b.name.toLowerCase() === botName?.toLowerCase()
    )
    if (matched) return matched
  }

  // 4. Text-based detection from message content (e.g. self-introductions or signatures)
  const textContent = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")

  if (textContent) {
    // Check self-identification: "I am **Quill**", "I'm Quill", "This is Quill", "Quill here", "Quill:"
    for (const b of chatBots) {
      const esc = b.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const introPattern = new RegExp(
        `(?:\\b(?:I am|I'm|This is|My name is|I am called)\\s+(?:\\*\\*)?${esc}(?:\\*\\*)?\\b|^(?:\\*\\*)?${esc}(?:\\*\\*)?:)`,
        "i"
      )
      if (introPattern.test(textContent)) {
        return b
      }
    }

    // Check job/role identification: "as your writing editor", "as a code reviewer"
    for (const b of chatBots) {
      if (b.job && b.job.trim().length > 2) {
        const escJob = b.job.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const jobPattern = new RegExp(
          `(?:as (?:your|a|an)\\s+(?:\\*\\*)?${escJob}(?:\\*\\*)?)`,
          "i"
        )
        if (jobPattern.test(textContent)) {
          return b
        }
      }
    }
  }

  // 5. Look back at preceding user message to see which bot was targeted
  if (message.role === "assistant") {
    for (let j = index - 1; j >= 0; j--) {
      if (allMessages[j].role === "user") {
        const prev = allMessages[j]
        const prevMeta = (prev as { metadata?: { botId?: string; botName?: string } }).metadata
        const prevBotPart = prev.parts.find((p) => p.type === "data-bot") as
          | { type: string; data?: { botId?: string; botName?: string } }
          | undefined

        const targetId = prevMeta?.botId || prevBotPart?.data?.botId
        const targetName = prevMeta?.botName || prevBotPart?.data?.botName

        if (targetId) {
          const matched = chatBots.find((b) => b.id === targetId)
          if (matched) return matched
        }
        if (targetName) {
          const matched = chatBots.find(
            (b) => b.name.toLowerCase() === targetName.toLowerCase()
          )
          if (matched) return matched
        }

        // Check if user specifically mentioned or addressed a bot by name (e.g. "@Quill" or "Quill, ...")
        const userText = prev.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join(" ")
        for (const b of chatBots) {
          const esc = b.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          if (new RegExp(`(?:^|\\s)@?${esc}\\b`, "i").test(userText)) {
            return b
          }
        }
        break
      }
    }

    // 6. Look back at preceding assistant message in this conversation
    for (let j = index - 1; j >= 0; j--) {
      if (allMessages[j].role === "assistant") {
        const prevText = allMessages[j].parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n")
        for (const b of chatBots) {
          const esc = b.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          if (
            new RegExp(
              `(?:\\b(?:I am|I'm|This is)\\s+(?:\\*\\*)?${esc}(?:\\*\\*)?\\b|^(?:\\*\\*)?${esc}(?:\\*\\*)?:)`,
              "i"
            ).test(prevText)
          ) {
            return b
          }
        }
      }
    }
  }

  // 7. For the currently active streaming turn, use activeStreamingBot
  if (activeStreamingBot && index === allMessages.length - 1 && message.role === "assistant") {
    return activeStreamingBot
  }

  // 8. Stable fallback: always the primary bot in the group, never currentBot
  return chatBots[0] ?? null
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

  // Automatically switch active composer bot when a hand-off occurs
  React.useEffect(() => {
    if (!isGroup) return
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastMsg.role !== "assistant") return

    // 1. Check data-handoff part in the latest message
    const handoffPart = lastMsg.parts.find((p) => p.type === "data-handoff") as
      | { type: string; data?: { targetBotId?: string } }
      | undefined
    if (handoffPart?.data?.targetBotId) {
      if (handoffPart.data.targetBotId !== selectedBotId) {
        onSelectBotId(handoffPart.data.targetBotId)
      }
      return
    }

    // 2. Check tool-call part for handOff
    for (const part of lastMsg.parts) {
      if (isToolUIPart(part)) {
        const toolName =
          "toolName" in part && typeof part.toolName === "string"
            ? part.toolName
            : part.type.replace(/^tool-/, "")
        if (toolName === "handOff" && part.state === "output-available") {
          const out = part.output as { targetBotId?: string } | undefined
          if (out?.targetBotId && out.targetBotId !== selectedBotId) {
            onSelectBotId(out.targetBotId)
            break
          }
        }
      }
    }
  }, [messages, isGroup, selectedBotId, onSelectBotId])

  const handleSubmit = React.useCallback(
    ({ text }: { text: string }) => {
      const trimmed = text.trim()
      if (!trimmed) return
      sendMessage(
        {
          text: trimmed,
          metadata: {
            ...clientData,
            botId: currentBot?.id,
            botName: currentBot?.name,
            botJob: currentBot?.job,
            botInstructions: currentBot?.instructions,
            sandboxId: currentBot?.sandboxId,
          },
        },
        {
          metadata: {
            ...clientData,
            botId: currentBot?.id,
            botName: currentBot?.name,
            botJob: currentBot?.job,
            botInstructions: currentBot?.instructions,
            sandboxId: currentBot?.sandboxId,
          },
        }
      )
    },
    [sendMessage, currentBot, clientData]
  )

  const handleSuggestionClick = React.useCallback(
    (suggestion: string) => {
      sendMessage(
        {
          text: suggestion,
          metadata: {
            ...clientData,
            botId: currentBot?.id,
            botName: currentBot?.name,
            botJob: currentBot?.job,
            botInstructions: currentBot?.instructions,
            sandboxId: currentBot?.sandboxId,
          },
        },
        {
          metadata: {
            ...clientData,
            botId: currentBot?.id,
            botName: currentBot?.name,
            botJob: currentBot?.job,
            botInstructions: currentBot?.instructions,
            sandboxId: currentBot?.sandboxId,
          },
        }
      )
    },
    [sendMessage, currentBot, clientData]
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
            messages.map((message, index) => {
              const isUser = message.role === "user"

              const isStreamingThis =
                status === "streaming" && index === messages.length - 1
              const activeStreamingBot = isStreamingThis ? currentBot : null

              // In group chats, resolve the specific bot that authored this message
              const msgBot = !isUser
                ? getBotForMessage(message, index, messages, chatBots, isGroup, activeStreamingBot)
                : null

              const msgAvatarSeed = msgBot?.avatar || msgBot?.name || avatarSeed
              const msgBotName = msgBot?.name || (isGroup ? "Bot" : botName)

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 w-full items-start ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isUser && (
                    <ChatAvatar
                      seed={msgAvatarSeed}
                      alt={msgBotName}
                      className={cn(
                        "size-8 shrink-0 rounded-full",
                        isGroup ? "mt-0.5" : "mt-1"
                      )}
                    />
                  )}

                  <div className={cn("flex flex-col gap-1 max-w-[85%] min-w-0", isUser && "items-end")}>
                    {!isUser && isGroup && (
                      <div className="flex items-center gap-2 leading-none pb-0.5">
                        <span className="text-xs font-semibold text-foreground">
                          {msgBotName}
                        </span>
                        {msgBot?.job && (
                          <span className="text-[11px] text-muted-foreground/80 font-normal">
                            · {msgBot.job}
                          </span>
                        )}
                      </div>
                    )}

                    <Message from={message.role} className="w-full">
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
