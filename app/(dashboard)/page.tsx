import { auth } from "@clerk/nextjs/server"
import { Plus } from "lucide-react"
import { nanoid } from "nanoid"
import { eq, desc } from "drizzle-orm"

import { ChatAvatar } from "@/components/chat-avatar"
import { BotDialog } from "@/components/bot-dialog"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { db } from "@/lib/db"
import { bots } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export default async function Page() {
  await auth.protect()
  const { userId } = await auth()

  const userBots = userId
    ? await db
        .select()
        .from(bots)
        .where(eq(bots.userId, userId))
        .orderBy(desc(bots.createdAt))
    : []

  const seed = nanoid()

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 text-foreground">

      {userBots.length === 0 ? (
        <Empty className="max-w-md flex-initial border-none p-0">
          <EmptyHeader className="max-w-md gap-2">
            <EmptyMedia className="mb-2">
              <ChatAvatar
                seed={seed}
                className="size-12 border border-border/40 shadow-sm"
              />
            </EmptyMedia>
            <EmptyTitle className="text-lg font-medium tracking-tight text-foreground sm:text-xl">
              Meet your first bot
            </EmptyTitle>
            <EmptyDescription className="max-w-sm text-sm/relaxed text-muted-foreground sm:text-base/relaxed">
              Every bot gets its own personality, memory, and face. Spin one up
              and start the conversation.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="mt-2">
            <BotDialog
              trigger={
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-10 rounded-xl px-5 text-sm font-medium shadow-xs cursor-pointer"
                >
                  <Plus data-icon="inline-start" />
                  Create a new bot
                </Button>
              }
            />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex w-full max-w-4xl flex-col gap-6 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Your Bots
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage and chat with your custom bots.
              </p>
            </div>
            <BotDialog
              trigger={
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 rounded-xl px-4 text-sm font-medium shadow-xs cursor-pointer"
                >
                  <Plus data-icon="inline-start" />
                  Create bot
                </Button>
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {userBots.map((bot) => (
              <div
                key={bot.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-5 shadow-xs transition-all hover:border-border"
              >
                <div className="flex items-center gap-3">
                  <ChatAvatar
                    seed={bot.avatar}
                    className="size-10 rounded-xl border border-border/40"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-base font-medium text-foreground">
                      {bot.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {bot.job}
                    </span>
                  </div>
                </div>
                {bot.instructions && (
                  <p className="line-clamp-3 text-xs/relaxed text-muted-foreground">
                    {bot.instructions}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
