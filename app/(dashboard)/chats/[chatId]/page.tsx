import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

import { getChat } from "@/queries/chats"
import { ChatHeader } from "@/components/chat-header"
import { ChatInterface } from "@/components/chat-interface"
import { SandboxVncPreview } from "@/components/sandbox-vnc-preview"
import { SidebarInset } from "@/components/ui/sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

type ChatPageProps = {
  params: Promise<{
    chatId: string
  }>
  searchParams: Promise<{
    desktop?: string
  }>
}

export default async function ChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  await auth.protect()

  const { chatId } = await params
  const { desktop } = (await searchParams) || {}
  const isDesktopOpen = desktop === "true" || desktop === "open"
  const chat = await getChat(chatId)

  if (!chat) {
    notFound()
  }

  const bot = chat.members?.[0]?.bot ?? chat.bot ?? null
  const botName = chat.name || bot?.name || "Bot"
  const sandboxId = bot?.sandboxId

  return (
    <SidebarInset className="flex h-svh flex-1 flex-col min-h-0 overflow-hidden bg-background">
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={isDesktopOpen ? 65 : 100} minSize={30}>
          <div className="flex h-full flex-col min-h-0 overflow-hidden">
            <ChatHeader chat={chat} isDesktopOpen={isDesktopOpen} />
            <ChatInterface chat={chat} />
          </div>
        </ResizablePanel>
        {isDesktopOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={20} className="bg-background">
              <SandboxVncPreview
                sandboxId={sandboxId}
                botName={botName}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </SidebarInset>
  )
}


