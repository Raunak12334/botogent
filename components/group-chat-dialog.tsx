"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChatAvatar } from "@/components/chat-avatar"
import { createGroupChat } from "@/actions/group-chat"
import type { Bot } from "@/lib/db/schema"

const groupChatFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  botIds: z.array(z.string()).min(2, "Select at least 2 bots"),
})

type GroupChatFormValues = z.infer<typeof groupChatFormSchema>

export interface GroupChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bots: Bot[]
  onSuccess?: (data: { chat: { id: string } }) => void
}

export function GroupChatDialog({
  open,
  onOpenChange,
  bots,
  onSuccess,
}: GroupChatDialogProps) {
  const form = useForm<GroupChatFormValues>({
    resolver: zodResolver(groupChatFormSchema),
    defaultValues: {
      name: "",
      botIds: [],
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = form

  const selectedBotIds = watch("botIds")
  const [serverError, setServerError] = React.useState<string | null>(null)

  const toggleBot = (botId: string) => {
    const current = selectedBotIds || []
    const next = current.includes(botId)
      ? current.filter((id) => id !== botId)
      : [...current, botId]
    setValue("botIds", next, { shouldValidate: true })
  }

  const onSubmit = async (values: GroupChatFormValues) => {
    setServerError(null)
    const result = await createGroupChat({
      name: values.name,
      botIds: values.botIds,
    })

    if (result.success) {
      reset()
      onOpenChange(false)
      onSuccess?.({ chat: { id: result.data.chat.id } })
    } else {
      setServerError(result.error)
    }
  }

  React.useEffect(() => {
    if (!open) {
      reset()
      setServerError(null)
    }
  }, [open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the group and pick which bots are in it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="group-chat-name">Name</Label>
            <Input
              id="group-chat-name"
              placeholder="Weekend plans"
              {...register("name")}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Bots</Label>
            {bots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No bots available. Create a bot first.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {bots.map((bot) => {
                  const isSelected = selectedBotIds?.includes(bot.id)
                  return (
                    <button
                      key={bot.id}
                      type="button"
                      onClick={() => toggleBot(bot.id)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent cursor-pointer"
                    >
                      <div
                        className={`size-4 shrink-0 rounded border transition-colors ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-input"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            className="size-4 text-primary-foreground"
                          >
                            <path
                              d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                      </div>
                      <ChatAvatar
                        seed={bot.avatar || bot.name}
                        className="size-7 rounded-full"
                      />
                      <span className="truncate font-medium">
                        {bot.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {errors.botIds && (
              <p className="text-xs text-destructive">
                {errors.botIds.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create group"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default GroupChatDialog
