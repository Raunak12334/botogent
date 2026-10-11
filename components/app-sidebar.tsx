"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { Plus, Search, Users } from "lucide-react"
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
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  const { state, isMobile } = useSidebar()
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <div className="flex items-center justify-end group-data-[collapsible=icon]:justify-center">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 group-data-[collapsible=icon]:size-8"
                        >
                          <Plus className="size-4" />
                          <span className="sr-only">Add</span>
                        </Button>
                      }
                    />
                  }
                />
                <TooltipContent
                  side="right"
                  align="center"
                  hidden={state !== "collapsed" || isMobile}
                >
                  Create new bot or group
                </TooltipContent>
              </Tooltip>
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

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex items-center gap-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent"
                >
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                    Search
                  </span>
                  <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">⌘K</Kbd>
                </button>
              }
            />
            <TooltipContent
              side="right"
              align="center"
              hidden={state !== "collapsed" || isMobile}
            >
              Search chats (⌘K)
            </TooltipContent>
          </Tooltip>
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
                        className="h-auto py-2 px-2 gap-3 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"
                        tooltip={name}
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
                className="h-auto p-0 hover:bg-transparent group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"
              >
                <UserButton
                  showName
                  appearance={{
                    elements: {
                      rootBox:
                        "w-full group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center",
                      userButtonTrigger:
                        "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring outline-hidden group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
                      userButtonBox:
                        "flex w-full items-center gap-2 flex-row group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
                      userButtonAvatarBox: "size-8 shrink-0 rounded-full",
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
        <SidebarRail />
      </Sidebar>

      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search chats"
        description="Search your chats and bots"
      >
        <CommandInput placeholder="Search chats..." />
        <CommandList>
          <CommandEmpty>No chats found.</CommandEmpty>
          <CommandGroup heading="Chats">
            {chats.map((chat) => {
              const bot = chat.bot
              const name = chat.name || bot?.name || "Chat"
              const avatarSeed = bot?.avatar || bot?.name || "Ada"
              const timeAgo = formatChatTime(
                chat.lastMessageAt || chat.createdAt
              )

              return (
                <CommandItem
                  key={chat.id}
                  value={`${name} ${chat.lastMessagePreview || ""}`}
                  onSelect={() => {
                    setSearchOpen(false)
                  }}
                  className="cursor-pointer gap-3 py-2"
                >
                  <ChatAvatar
                    seed={avatarSeed}
                    className="size-8 rounded-full"
                  />
                  <div className="flex flex-1 flex-col min-w-0 text-left">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate font-medium text-foreground">
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
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

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
