"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { Plus, Users } from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"

import { Button } from "@/components/ui/button"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BotDialog } from "@/components/bot-dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import type { UserChat } from "@/queries/bots"

function formatChatTime(date: Date | string | null | undefined): string {
  if (!date) return ""
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: false })
  } catch {
    return ""
  }
}

export interface AppSidebarProps
  extends React.ComponentProps<typeof Sidebar> {
  chats?: UserChat[]
}

export function AppSidebar({ chats = [], ...props }: AppSidebarProps) {
  const router = useRouter()
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)

  return (
    <>
      <Sidebar {...props}>
        <SidebarHeader>
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                  >
                    <Plus className="size-4" />
                    <span className="sr-only">Add</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => setBotDialogOpen(true)}
                  >
                    <Plus className="size-4" />
                    <span>Create new bot</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer gap-2">
                    <Users className="size-4" />
                    <span>Create group chat</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.map((chat) => {
                  const bot = chat.bot
                  const name = chat.name || bot?.name || "Chat"
                  const avatarSeed = bot?.avatar || bot?.name || "Ada"
                  const timeAgo = formatChatTime(
                    chat.lastMessageAt || chat.createdAt
                  )

                  return (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        size="lg"
                        className="h-auto py-2 px-2 gap-3"
                      >
                        <ChatAvatar
                          seed={avatarSeed}
                          className="size-8 rounded-full"
                        />
                        <div className="flex flex-1 flex-col min-w-0 text-left group-data-[collapsible=icon]:hidden">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-sm font-medium text-sidebar-foreground">
                              {name}
                            </span>
                            {timeAgo && (
                              <span
                                className="shrink-0 text-xs text-muted-foreground"
                                suppressHydrationWarning
                              >
                                {timeAgo}
                              </span>
                            )}
                          </div>
                          <span className="truncate text-xs text-muted-foreground">
                            {chat.lastMessagePreview || "No messages yet"}
                          </span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<div />}
                className="h-auto p-0 hover:bg-transparent"
              >
                <UserButton
                  showName
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      userButtonTrigger:
                        "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring outline-hidden",
                      userButtonBox: "flex w-full items-center gap-2 flex-row",
                      userButtonAvatarBox: "size-8 shrink-0 rounded-lg",
                      userButtonOuterIdentifier:
                        "truncate text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden",
                      userButtonPopoverCard:
                        "border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg",
                    },
                  }}
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <BotDialog
        open={botDialogOpen}
        onOpenChange={setBotDialogOpen}
        onSuccess={() => {
          router.refresh()
        }}
      />
    </>
  )
}
