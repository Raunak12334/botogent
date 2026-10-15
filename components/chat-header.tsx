"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Box, Monitor, MoreVertical, Trash2, Loader2, Pencil, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { EditGroupChatDialog } from "@/components/edit-group-chat-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { deleteBot } from "@/actions/bot"
import { cn } from "@/lib/utils"
import type { ChatWithMembers } from "@/queries/chats"
import type { UserChat } from "@/queries/bots"
import type { Bot } from "@/lib/db/schema"

export interface ChatHeaderProps extends React.ComponentProps<"header"> {
  chat?:
    | ChatWithMembers
    | UserChat
    | {
        id: string
        kind?: "individual" | "group"
        name?: string | null
        bot?: {
          id: string
          name: string
          avatar?: string | null
          sandboxId?: string | null
        } | null
        bots?: Array<{
          id: string
          name: string
          avatar?: string | null
          sandboxId?: string | null
          job?: string | null
        }>
        members?: Array<{
          bot: {
            id: string
            name: string
            avatar?: string | null
            sandboxId?: string | null
            job?: string | null
          }
        }>
      }
    | null
  allBots?: Bot[]
  isDesktopOpen?: boolean
  onToggleDesktop?: () => void
}

/**
 * ChatHeader displays the bot or group avatar, title, and actions.
 * Group chats use GroupChatAvatar, have an interactive header to open edit settings,
 * and have the desktop panel option disabled.
 */
export function ChatHeader({
  chat,
  allBots = [],
  className,
  isDesktopOpen: isDesktopOpenProp,
  onToggleDesktop,
  ...props
}: ChatHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [editGroupOpen, setEditGroupOpen] = React.useState(false)

  const isGroup =
    chat?.kind === "group" ||
    (chat && "bots" in chat && Array.isArray(chat.bots) && chat.bots.length > 1) ||
    (chat && "members" in chat && Array.isArray(chat.members) && chat.members.length > 1)

  const isDesktopOpen =
    !isGroup &&
    (isDesktopOpenProp !== undefined
      ? isDesktopOpenProp
      : searchParams.get("desktop") === "true" || searchParams.get("desktop") === "open")

  const handleToggleDesktop = () => {
    if (isGroup) return
    if (onToggleDesktop) {
      onToggleDesktop()
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    if (isDesktopOpen) {
      params.delete("desktop")
    } else {
      params.set("desktop", "true")
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const members = chat && "members" in chat ? chat.members : undefined
  const chatBots =
    chat && "bots" in chat && Array.isArray(chat.bots) && chat.bots.length > 0
      ? chat.bots
      : members?.map((m) => m.bot).filter(Boolean) ?? []

  const firstMember = members?.[0]
  const bot = firstMember?.bot ?? chat?.bot ?? null
  const botName = chat?.name || (isGroup ? "Group Chat" : (bot?.name || "Chat"))

  const avatarSeeds = chatBots.map((b) => b.avatar || b.name)
  const avatarSeed = bot?.avatar || bot?.name || "Ada"

  const handleDeleteBot = async () => {
    if (!bot?.id) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await deleteBot(bot.id)
      if (res.success) {
        setDeleteOpen(false)
        router.refresh()
        router.push("/")
      } else {
        setDeleteError(res.error)
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete bot")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <header
        className={cn(
          "flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-background px-4",
          className
        )}
        {...props}
      >
        {isGroup ? (
          <button
            type="button"
            onClick={() => setEditGroupOpen(true)}
            className="group/header-btn flex items-center gap-2.5 min-w-0 rounded-lg p-1.5 -ml-1.5 text-left transition-colors hover:bg-accent/60 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Edit group chat settings (change name, members, delete)"
            aria-label="Edit group chat settings"
          >
            {avatarSeeds.length > 1 ? (
              <GroupChatAvatar
                seeds={avatarSeeds}
                sizeClassName="size-7"
                className="rounded-full shrink-0"
              />
            ) : (
              <ChatAvatar
                seed={avatarSeed}
                alt={botName}
                className="size-7 rounded-full shrink-0"
              />
            )}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-foreground group-hover/header-btn:text-primary transition-colors">
                  {botName}
                </span>
                <Pencil className="size-3 text-muted-foreground/60 opacity-0 group-hover/header-btn:opacity-100 transition-opacity" />
              </div>
              <span className="text-[11px] text-muted-foreground truncate">
                {chatBots.length} bots • Click to edit
              </span>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <ChatAvatar
              seed={avatarSeed}
              alt={botName}
              className="size-7 rounded-full shrink-0"
            />
            <span className="truncate text-sm font-medium text-foreground">
              {botName}
            </span>
            {bot?.sandboxId && (
              <div
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 font-mono text-[11px] text-neutral-300"
                title={`Daytona Sandbox ID: ${bot.sandboxId}`}
              >
                <Box className="size-3 text-emerald-400 shrink-0" />
                <span className="text-neutral-400">Sandbox:</span>
                <span className="truncate max-w-[100px]">{bot.sandboxId.slice(0, 8)}...</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {!isGroup && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={isDesktopOpen ? "secondary" : "ghost"}
                    size="icon-sm"
                    type="button"
                    className={cn(
                      "cursor-pointer",
                      isDesktopOpen
                        ? "text-foreground bg-accent"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Desktop"
                    onClick={handleToggleDesktop}
                  >
                    <Monitor className="size-4" />
                  </Button>
                }
              />
              <TooltipContent side="bottom" align="end">
                {isDesktopOpen ? "Close desktop" : "Desktop"}
              </TooltipContent>
            </Tooltip>
          )}

          {isGroup && chat?.id && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label="Group options"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => setEditGroupOpen(true)}
                >
                  <Settings className="size-4" />
                  <span>Edit group</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onClick={() => setEditGroupOpen(true)}
                >
                  <Trash2 className="size-4" />
                  <span>Delete group</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isGroup && bot?.id && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label="More actions"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  <span>Delete bot</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {isGroup && chat?.id && (
        <EditGroupChatDialog
          open={editGroupOpen}
          onOpenChange={setEditGroupOpen}
          chatId={chat.id}
          initialName={chat.name || "Group Chat"}
          initialBotIds={chatBots.map((b) => b.id)}
          allBots={allBots.length > 0 ? allBots : chatBots}
        />
      )}

      {!isGroup && bot && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete bot</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong className="text-foreground">{bot.name}</strong>?
                This will permanently delete the bot, close this chat, and destroy its associated Daytona sandbox.
              </DialogDescription>
            </DialogHeader>

            {deleteError && (
              <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                {deleteError}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeleteBot}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete bot"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export default ChatHeader
