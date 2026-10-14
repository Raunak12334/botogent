import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { getUserChats, getUserBots } from "@/queries/bots"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [chats, bots] = await Promise.all([getUserChats(), getUserBots()])

  return (
    <SidebarProvider>
      <AppSidebar chats={chats} bots={bots} />
      {children}
    </SidebarProvider>
  )
}

