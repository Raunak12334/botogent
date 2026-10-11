import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { getUserChats } from "@/queries/bots"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const chats = await getUserChats()

  return (
    <SidebarProvider>
      <AppSidebar chats={chats} />
      {children}
    </SidebarProvider>
  )
}

