"use client"

import * as React from "react"
import {
  RotateCcw,
  Maximize2,
  Minimize2,
  Monitor,
  Loader2,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { getSandboxVncUrl } from "@/actions/sandbox"
import { cn } from "@/lib/utils"

export interface SandboxVncPreviewProps {
  sandboxId?: string | null
  botName?: string
  className?: string
}

/**
 * SandboxVncPreview renders an interactive Daytona VNC sandbox preview.
 * Clicking the preview seamlessly expands it into a full-screen Dialog.
 *
 * CRITICAL ARCHITECTURE:
 * The <iframe> element is rendered once and never detached or remounted,
 * preserving the active VNC WebSocket connection across preview and full-screen modes.
 */
export function SandboxVncPreview({
  sandboxId,
  botName = "Bot",
  className,
}: SandboxVncPreviewProps) {
  const [isFullScreen, setIsFullScreen] = React.useState(false)
  const [vncUrl, setVncUrl] = React.useState<string | null>(null)
  const [directUrl, setDirectUrl] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(Boolean(sandboxId))
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  const fetchVncUrl = React.useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getSandboxVncUrl(id)
      if (res.success) {
        setVncUrl(res.url)
        setDirectUrl(res.directUrl || res.url)
      } else {
        setError(res.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Daytona VNC preview")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (sandboxId) {
      fetchVncUrl(sandboxId)
    } else {
      setIsLoading(false)
    }
  }, [sandboxId, fetchVncUrl])

  const handleRefresh = async () => {
    if (!sandboxId) return
    setIsRefreshing(true)
    try {
      if (iframeRef.current && vncUrl) {
        // Refresh the existing connection directly
        iframeRef.current.src = vncUrl
      } else {
        await fetchVncUrl(sandboxId)
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 800)
    }
  }

  return (
    <div className={cn("relative flex h-full w-full flex-col bg-background p-4 select-none", className)}>
      {/* Top action bar with Refresh and Pop-out icons */}
      <div className="flex h-10 w-full shrink-0 items-center justify-end gap-1 px-1">
        {vncUrl && (
          <Button
            variant="ghost"
            size="icon-sm"
            render={<a href={directUrl || vncUrl} target="_blank" rel="noopener noreferrer" />}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Open desktop in new window"
            title="Open desktop in new window"
          >
            <ExternalLink className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={handleRefresh}
          disabled={!sandboxId || isRefreshing}
          className="text-muted-foreground hover:text-foreground cursor-pointer transition-transform"
          aria-label="Refresh VNC display"
          title="Refresh screen"
        >
          <RotateCcw className={cn("size-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Main Preview Container: aligned to the top instead of centered */}
      <div className="flex flex-1 flex-col items-center justify-start min-h-0 w-full px-2 pt-2">
        {/*
          The VNC frame:
          - When previewing: renders within normal flow as a tablet/monitor bezel.
          - When full screen: transforms via CSS fixed positioning to cover the viewport.
          Because it remains the same DOM node, the iframe never reloads!
        */}
        <div
          className={cn(
            "transition-all duration-200",
            isFullScreen
              ? "fixed inset-3 sm:inset-6 md:inset-8 z-[90] flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden"
              : "relative w-full max-w-[420px] rounded-2xl border border-neutral-800 bg-neutral-900/90 p-2 sm:p-2.5 shadow-xl group"
          )}
          onKeyDownCapture={(e) => {
            // Stop Escape and other keys from closing the dialog or page shortcuts
            if (isFullScreen && e.key === "Escape") {
              e.stopPropagation()
            }
          }}
        >
          {/* Header visible ONLY in Full Screen mode */}
          {isFullScreen && (
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900/95 px-4 text-sm text-foreground">
              <div className="flex items-center gap-2.5 min-w-0">
                <Monitor className="size-4 text-emerald-400 shrink-0" />
                <span className="font-medium truncate">{botName}&apos;s Desktop</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live VNC
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {vncUrl && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={<a href={directUrl || vncUrl} target="_blank" rel="noopener noreferrer" />}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Open in new window"
                    aria-label="Open in new window"
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Refresh VNC connection"
                >
                  <RotateCcw className={cn("size-4", isRefreshing && "animate-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  onClick={() => setIsFullScreen(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Exit full screen"
                  aria-label="Exit full screen"
                >
                  <Minimize2 className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Screen Content Window */}
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-xl bg-[#0b6374]",
              isFullScreen ? "flex-1 min-h-0 bg-neutral-950" : "aspect-[16/10]"
            )}
          >
            {/* Simulated Desktop Preview Placeholder (matches attached image) */}
            <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
              {/* Window title bar */}
              <div className="h-3.5 w-full bg-neutral-300/40" />

              {/* Desktop interior with desktop icons and taskbar dock */}
              <div className="relative flex-1 p-3">
                {/* 3 stacked desktop icons on left side */}
                <div className="flex flex-col gap-2.5">
                  <div className="size-4.5 rounded-xs bg-neutral-300/60 shadow-xs" />
                  <div className="size-4.5 rounded-xs bg-neutral-300/60 shadow-xs" />
                  <div className="size-4.5 rounded-xs bg-neutral-300/60 shadow-xs" />
                </div>

                {/* Bottom centered taskbar dock */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-3 w-28 rounded-t-xs bg-neutral-900/60" />
              </div>
            </div>

            {/* Live noVNC iframe (rendered once, permanent) */}
            {vncUrl && (
              <iframe
                ref={iframeRef}
                src={vncUrl}
                className={cn(
                  "absolute inset-0 size-full border-0 transition-opacity duration-300",
                  isLoading ? "opacity-0" : "opacity-100"
                )}
                allow="clipboard-read; clipboard-write; fullscreen"
                title={`${botName}'s VNC screen`}
              />
            )}

            {/* Loading state overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-black/40 backdrop-blur-xs text-neutral-200">
                <Loader2 className="size-6 animate-spin text-emerald-400" />
                <span className="text-xs font-medium tracking-wide">Starting Daytona VNC...</span>
              </div>
            )}

            {/* Error state overlay */}
            {error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-4 text-center bg-black/70 backdrop-blur-xs text-neutral-200">
                <AlertCircle className="size-5 text-red-400 shrink-0" />
                <p className="text-xs text-neutral-300 max-w-[240px] truncate">{error}</p>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => sandboxId && fetchVncUrl(sandboxId)}
                  className="mt-1 cursor-pointer text-xs"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* No sandbox configured */}
            {!sandboxId && !isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-4 text-center bg-black/60 text-neutral-300">
                <Monitor className="size-6 text-neutral-500" />
                <p className="text-xs font-medium text-neutral-400">No active Daytona sandbox</p>
              </div>
            )}

            {/*
              Preview-mode Click Overlay:
              Intercepts clicks on the preview so the user can easily open full screen
              without the iframe absorbing the initial pointer click.
            */}
            {!isFullScreen && !isLoading && !error && sandboxId && (
              <button
                type="button"
                onClick={() => setIsFullScreen(true)}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors cursor-pointer group"
                aria-label="Expand to full screen"
              >
                <div className="opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 rounded-full bg-neutral-900/90 border border-neutral-700/80 px-3 py-1.5 text-xs text-neutral-200 flex items-center gap-1.5 shadow-lg">
                  <Maximize2 className="size-3.5 text-neutral-300" />
                  <span className="font-medium">Full screen</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Centered label under the screen bezel (e.g., "Quill's screen") */}
        {!isFullScreen && (
          <div className="mt-4 text-center text-sm font-medium text-neutral-300">
            {botName}&apos;s screen
          </div>
        )}
      </div>

      {/*
        Full Screen Backdrop:
        Only mounted in the DOM when isFullScreen is true, ensuring zero risk of
        lingering dimmed backdrops after exiting full screen.
        Ignores outside clicks to protect in-flight VNC terminal/editor sessions.
      */}
      {isFullScreen && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm animate-in fade-in-0 duration-150"
          onClick={(e) => e.stopPropagation()}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default SandboxVncPreview
