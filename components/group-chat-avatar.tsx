"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChatAvatar } from "@/components/chat-avatar"

export interface GroupChatAvatarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Array of avatar seeds (one per bot in the group) */
  seeds: string[]
  /** Total outer size class (should match single ChatAvatar size, e.g. "size-8" or "size-7") */
  sizeClassName?: string
}

/**
 * Composite avatar for group chats.
 * Shows up to 3 visible bot avatars arranged in a square avatar container.
 * Layout:
 *  - 1 bot:  single avatar (full)
 *  - 2 bots: side-by-side, overlapping horizontally
 *  - 3 bots: triangle (1 top-center, 2 bottom)
 *  - 4+ bots: 2x2 grid (3 visible bot avatars + "+N" overflow badge)
 * The total size taken is identical to a single chat avatar.
 */
export function GroupChatAvatar({
  seeds,
  sizeClassName = "size-8",
  className,
  ...props
}: GroupChatAvatarProps) {
  if (seeds.length === 0) {
    return (
      <div
        className={cn(
          sizeClassName,
          "shrink-0 rounded-full bg-muted",
          className
        )}
        {...props}
      />
    )
  }

  if (seeds.length === 1) {
    return (
      <ChatAvatar
        seed={seeds[0]}
        className={cn(sizeClassName, "rounded-full", className)}
      />
    )
  }

  return (
    <div
      className={cn(
        sizeClassName,
        "relative shrink-0 rounded-full overflow-hidden bg-muted/60",
        className
      )}
      {...props}
    >
      {seeds.length === 2 && (
        <>
          {/* Two items: side-by-side, horizontally overlapping in center */}
          <ChatAvatar
            seed={seeds[0]}
            className="absolute top-1/2 -translate-y-1/2 left-0 size-[62%] rounded-full ring-1 ring-background z-10"
          />
          <ChatAvatar
            seed={seeds[1]}
            className="absolute top-1/2 -translate-y-1/2 right-0 size-[62%] rounded-full ring-1 ring-background"
          />
        </>
      )}

      {seeds.length === 3 && (
        <>
          {/* Three items: triangle — 1 top-center, 2 bottom */}
          <ChatAvatar
            seed={seeds[0]}
            className="absolute top-[2%] left-1/2 -translate-x-1/2 size-[50%] rounded-full ring-1 ring-background z-10"
          />
          <ChatAvatar
            seed={seeds[1]}
            className="absolute bottom-[2%] left-[4%] size-[50%] rounded-full ring-1 ring-background"
          />
          <ChatAvatar
            seed={seeds[2]}
            className="absolute bottom-[2%] right-[4%] size-[50%] rounded-full ring-1 ring-background"
          />
        </>
      )}

      {seeds.length >= 4 && (
        <>
          {/* 2x2 grid: first 3 visible bots + 4th slot with remaining count badge */}
          <ChatAvatar
            seed={seeds[0]}
            className="absolute top-[4%] left-[4%] size-[46%] rounded-full ring-1 ring-background"
          />
          <ChatAvatar
            seed={seeds[1]}
            className="absolute top-[4%] right-[4%] size-[46%] rounded-full ring-1 ring-background"
          />
          <ChatAvatar
            seed={seeds[2]}
            className="absolute bottom-[4%] left-[4%] size-[46%] rounded-full ring-1 ring-background"
          />
          <div className="absolute bottom-[4%] right-[4%] size-[46%] rounded-full ring-1 ring-background bg-secondary text-secondary-foreground flex items-center justify-center font-semibold text-[10px] select-none leading-none">
            +{seeds.length - 3}
          </div>
        </>
      )}
    </div>
  )
}

export default GroupChatAvatar
