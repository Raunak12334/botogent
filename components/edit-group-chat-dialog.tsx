"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Loader2, Users, AlertCircle, Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChatAvatar } from "@/components/chat-avatar";
import { DynamicButton } from "@/components/DynamicButton";
import {
  updateGroupChat,
  deleteGroupChat,
  getAvailableBots,
} from "@/actions/group-chat";
import type { Bot } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const editGroupChatSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100, "Group name is too long"),
  botIds: z.array(z.string()).min(2, "Select at least 2 bots for a group chat"),
});

export type EditGroupChatFormValues = z.infer<typeof editGroupChatSchema>;

export type EditGroupBot = {
  id: string;
  name: string;
  avatar?: string | null;
  job?: string | null;
  [key: string]: any;
};

export interface EditGroupChatDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  chatId: string;
  initialName?: string | null;
  initialBotIds?: string[];
  allBots?: EditGroupBot[];
  trigger?: React.ReactElement;
  onSuccess?: () => void;
  onDeleted?: () => void;
}

export function EditGroupChatDialog({
  open: openProp,
  onOpenChange,
  chatId,
  initialName = "",
  initialBotIds = [],
  allBots: allBotsProp = [],
  trigger,
  onSuccess,
  onDeleted,
}: EditGroupChatDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const [availableBots, setAvailableBots] = React.useState<EditGroupBot[]>(allBotsProp);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen);
      } else {
        setInternalOpen(nextOpen);
      }
      if (!nextOpen) {
        setConfirmDelete(false);
        setServerError(null);
      }
    },
    [isControlled, onOpenChange]
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditGroupChatFormValues>({
    resolver: zodResolver(editGroupChatSchema),
    defaultValues: {
      name: initialName || "Group Chat",
      botIds: initialBotIds,
    },
  });

  const selectedBotIds = watch("botIds") || [];

  // Sync initial values when dialog opens or props change
  React.useEffect(() => {
    if (open) {
      reset({
        name: initialName || "Group Chat",
        botIds: initialBotIds,
      });
      setConfirmDelete(false);
      setServerError(null);

      // If available bots were not provided or only have group members, fetch all user bots
      if (allBotsProp.length <= initialBotIds.length) {
        getAvailableBots().then((fetched) => {
          if (fetched && fetched.length > 0) {
            setAvailableBots(fetched);
          }
        });
      }
    }
  }, [open, initialName, initialBotIds, reset, allBotsProp]);

  // Keep availableBots updated if prop changes
  React.useEffect(() => {
    if (allBotsProp.length > 0) {
      setAvailableBots(allBotsProp);
    }
  }, [allBotsProp]);

  const toggleBot = (botId: string) => {
    const current = selectedBotIds;
    const next = current.includes(botId)
      ? current.filter((id) => id !== botId)
      : [...current, botId];
    setValue("botIds", next, { shouldValidate: true });
  };

  const onSubmit = async (values: EditGroupChatFormValues) => {
    setServerError(null);
    try {
      const result = await updateGroupChat({
        chatId,
        name: values.name,
        botIds: values.botIds,
      });

      if (result.success) {
        handleOpenChange(false);
        onSuccess?.();
        router.refresh();
      } else {
        setServerError(result.error);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update group chat");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setServerError(null);
    try {
      const result = await deleteGroupChat(chatId);
      if (result.success) {
        handleOpenChange(false);
        onDeleted?.();
        router.push("/");
        router.refresh();
      } else {
        setServerError(result.error);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to delete group chat");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-w-[460px] gap-0 border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-2xl sm:rounded-2xl">
        <DialogHeader className="gap-1.5 pb-4 text-left">
          <div className="flex items-center gap-2 text-primary">
            <Users className="size-5" />
            <DialogTitle className="text-lg font-semibold tracking-tight text-white">
              Edit group chat
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-neutral-400">
            Update group name, add or remove AI teammates, or delete this conversation.
          </DialogDescription>
        </DialogHeader>

        {confirmDelete ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-left">
                  <p className="text-sm font-semibold text-red-200">
                    Delete &ldquo;{initialName || "Group Chat"}&rdquo;?
                  </p>
                  <p className="text-xs text-red-300/80 leading-relaxed">
                    This will permanently delete this group chat and its message history.
                    Your individual bots and their Daytona sandboxes will{" "}
                    <strong className="text-red-200">not</strong> be deleted.
                  </p>
                </div>
              </div>
            </div>

            {serverError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
                {serverError}
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="text-neutral-400 hover:text-white"
              >
                Back to edit
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-1.5 size-3.5" />
                    Confirm delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Group Name */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="group-name" className="text-xs font-medium text-neutral-300">
                Group name
              </Label>
              <Input
                id="group-name"
                placeholder="e.g. Trillion Company, Code Review Team"
                {...register("name")}
                className="h-9 rounded-lg border-neutral-800 bg-neutral-900/80 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:border-neutral-600 focus-visible:ring-1 focus-visible:ring-neutral-600"
              />
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name.message}</p>
              )}
            </div>

            {/* Member Bots Selector */}
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-neutral-300">
                  Members ({selectedBotIds.length} selected)
                </Label>
                <span className="text-[11px] text-neutral-500">
                  Minimum 2 bots
                </span>
              </div>

              {availableBots.length === 0 ? (
                <p className="text-xs text-neutral-500 py-3 text-center">
                  Loading available bots...
                </p>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1 rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-1.5">
                  {availableBots.map((b) => {
                    const isSelected = selectedBotIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBot(b.id)}
                        className={cn(
                          "group/bot flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer",
                          isSelected
                            ? "bg-neutral-800/80 text-white"
                            : "text-neutral-300 hover:bg-neutral-800/40 hover:text-white"
                        )}
                      >
                        {/* Checkbox indicator */}
                        <div
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-neutral-700 bg-neutral-900 group-hover/bot:border-neutral-500"
                          )}
                        >
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </div>

                        {/* Bot Avatar */}
                        <ChatAvatar
                          seed={b.avatar || b.name}
                          className="size-7 rounded-full shrink-0"
                        />

                        {/* Bot Name & Job */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate text-xs font-medium text-neutral-100">
                            {b.name}
                          </span>
                          <span className="truncate text-[11px] text-neutral-400">
                            {b.job || "Specialist"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {errors.botIds && (
                <p className="text-xs text-red-400">{errors.botIds.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
                {serverError}
              </div>
            )}

            {/* Actions: Delete on Left, Cancel + Save on Right */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="h-8 gap-1.5 px-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
                disabled={isSubmitting}
              >
                <Trash2 className="size-3.5" />
                Delete group
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <DynamicButton
                  type="submit"
                  variant="secondary"
                  className="h-8 rounded-lg px-3.5 text-xs font-medium"
                  disabled={isSubmitting || selectedBotIds.length < 2}
                >
                  {isSubmitting ? "Saving..." : "Save changes"}
                </DynamicButton>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EditGroupChatDialog;
