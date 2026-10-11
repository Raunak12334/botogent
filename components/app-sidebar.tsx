"use client"

import * as React from "react"
import { UserButton } from "@clerk/nextjs"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader />
      <SidebarContent />
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
  )
}
