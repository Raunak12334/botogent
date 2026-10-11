import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

import { getChat } from "@/queries/chats"
import { ChatHeader } from "@/components/chat-header"
import { SidebarInset } from "@/components/ui/sidebar"

type ChatPageProps = {
  params: Promise<{
    chatId: string
  }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  await auth.protect()

  const { chatId } = await params
  const chat = await getChat(chatId)

  if (!chat) {
    notFound()
  }

  return (
    <SidebarInset className="flex h-svh flex-1 flex-col min-h-0 overflow-hidden bg-background">
      <ChatHeader chat={chat} />
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {/* Chat message content */}
      </div>
    </SidebarInset>
  )
}
