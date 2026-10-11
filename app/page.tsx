import { auth } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import { Plus } from "lucide-react"
import { nanoid } from "nanoid"

import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export const dynamic = "force-dynamic"

export default async function Page() {
  await auth.protect()

  const seed = nanoid()

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="absolute top-4 right-4">
        <UserButton />
      </div>

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
          <Button
            variant="secondary"
            size="lg"
            className="h-10 rounded-xl px-5 text-sm font-medium shadow-xs"
          >
            <Plus data-icon="inline-start" />
            Create a new bot
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
