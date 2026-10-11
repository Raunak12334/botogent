"use client"

import * as React from "react"
import { Monitor } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ChatWithMembers } from "@/queries/chats"
import type { UserChat } from "@/queries/bots"

export interface ChatHeaderProps extends React.ComponentProps<"header"> {
  chat?:
    | ChatWithMembers
    | UserChat
    | {
        id: string
        name?: string | null
        bot?: {
          id: string
          name: string
          avatar?: string | null
        } | null
        members?: Array<{
          bot: {
            id: string
            name: string
            avatar?: string | null
          }
        }>
      }
    | null
}

/**
 * ChatHeader displays the bot avatar, chat/bot name, and an inactive desktop button.
 * For group chats, it currently falls back to the first member's information.
 */
export function ChatHeader({ chat, className, ...props }: ChatHeaderProps) {
  // Ignore group chat for now, simply use the first chat member's information
  const members = chat && "members" in chat ? chat.members : undefined
  const firstMember = members?.[0]
  const bot = firstMember?.bot ?? chat?.bot ?? null
  const botName = chat?.name || bot?.name || "Chat"
  const avatarSeed = bot?.avatar || bot?.name || "Ada"

  return (
    <header
      className={cn(
        "flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-background px-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        <ChatAvatar
          seed={avatarSeed}
          alt={botName}
          className="size-7 rounded-full shrink-0"
        />
        <span className="truncate text-sm font-medium text-foreground">
          {botName}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Desktop"
              >
                <Monitor className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="bottom" align="end">
            Desktop
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

export default ChatHeader
