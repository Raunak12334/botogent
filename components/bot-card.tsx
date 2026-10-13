"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, MessageSquare, MoreVertical, Trash2, Loader2 } from "lucide-react";

import { ChatAvatar } from "@/components/chat-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteBot } from "@/actions/bot";
import type { Bot } from "@/lib/db/schema";

export interface BotCardProps {
  bot: Bot;
  chatId?: string | null;
}

export function BotCard({ bot, chatId }: BotCardProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await deleteBot(bot.id);
      if (res.success) {
        setDeleteOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete bot");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-border/50 bg-card p-5 shadow-xs transition-all hover:border-border hover:shadow-md">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <ChatAvatar
                seed={bot.avatar}
                className="size-11 shrink-0 rounded-xl border border-border/40"
              />
              <div className="flex flex-col min-w-0">
                <span className="truncate text-base font-semibold text-foreground">
                  {bot.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {bot.job}
                </span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label="Bot options"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                {chatId && (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => router.push(`/chats/${chatId}`)}
                  >
                    <MessageSquare className="size-4" />
                    <span>Open chat</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  <span>Delete bot</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {bot.instructions && (
            <p className="line-clamp-3 text-xs/relaxed text-muted-foreground">
              {bot.instructions}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs">
          {bot.sandboxId ? (
            <div
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 font-mono text-[11px] text-neutral-300"
              title={`Daytona Sandbox ID: ${bot.sandboxId}`}
            >
              <Box className="size-3 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[130px]">
                {bot.sandboxId.slice(0, 10)}...
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              No sandbox attached
            </span>
          )}

          {chatId && (
            <Link
              href={`/chats/${chatId}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 hover:text-foreground hover:underline"
            >
              <MessageSquare className="size-3.5" />
              Chat
            </Link>
          )}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete bot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{bot.name}</strong>?
              This will permanently remove the bot and destroy its associated Daytona sandbox.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
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
              onClick={handleDelete}
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
    </>
  );
}
