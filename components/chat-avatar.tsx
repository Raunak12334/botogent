"use client"

import * as React from "react"
import Image, { type ImageProps } from "next/image"
import { Style, Avatar } from "@dicebear/core"
import adventurer from "@dicebear/styles/adventurer.json"
import { cn } from "cn"

const adventurerStyle = new Style(adventurer)
const avatarCache = new Map<string, string>()

function getAdventurerDataUri(seed: string, animated?: boolean): string {
  const cacheKey = `${seed}::${Boolean(animated)}`
  const cached = avatarCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const avatar = new Avatar(adventurerStyle, {
    seed,
    tags: animated ? ["animation"] : undefined,
  })

  const uri = avatar.toDataUri()
  avatarCache.set(cacheKey, uri)
  return uri
}

export interface ChatAvatarProps
  extends Omit<ImageProps, "src" | "alt" | "width" | "height"> {
  /** The unique seed to generate the avatar deterministically */
  seed: string
  /** Whether the avatar should display an animated effect */
  animated?: boolean
  /** Optional class name to style and resize the avatar (e.g. size-10, size-12) */
  className?: string
  /** Accessible alt text for the avatar image */
  alt?: string
  /** Optional width in pixels (defaults to 32) */
  width?: number
  /** Optional height in pixels (defaults to 32) */
  height?: number
}

/**
 * ChatAvatar component rendering a DiceBear Adventurer avatar using Next.js Image.
 * Defaults to 32x32 pixels, customizable via className or width/height props.
 */
export function ChatAvatar({
  seed,
  animated = false,
  className,
  alt,
  width = 32,
  height = 32,
  unoptimized = true,
  ...props
}: ChatAvatarProps) {
  const avatarSrc = React.useMemo(() => {
    return getAdventurerDataUri(seed || "anonymous", animated)
  }, [seed, animated])

  return (
    <Image
      src={avatarSrc}
      alt={alt ?? `Avatar for ${seed || "user"}`}
      width={width}
      height={height}
      unoptimized={unoptimized}
      className={cn(
        "size-8 shrink-0 rounded-full object-cover",
        animated && "animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export default ChatAvatar
