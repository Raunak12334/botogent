"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Shuffle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChatAvatar } from "@/components/chat-avatar";
import { DynamicButton } from "@/components/DynamicButton";
import { createBot, type CreateBotData } from "@/actions/bot";
import type { Bot } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const botFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  job: z.string().trim().min(1, "Job is required").max(100, "Job is too long"),
  instructions: z.string().trim().max(1000, "Instructions too long").optional(),
  avatar: z.string().min(1, "Avatar is required"),
});

export type BotFormValues = z.infer<typeof botFormSchema>;

const BOT_TEMPLATES = [
  {
    name: "Ada",
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    name: "Linty",
    job: "Code reviewer",
    instructions:
      "Review code thoroughly for bugs, performance, security, and edge cases. Suggest clean fixes.",
  },
  {
    name: "Quill",
    job: "Writing editor",
    instructions:
      "Improve clarity, flow, style, and tone while keeping the voice intact. Check grammar carefully.",
  },
  {
    name: "Socrates",
    job: "Tutor",
    instructions:
      "Explain concepts step-by-step, provide illustrative examples, and test understanding with questions.",
  },
];

export interface BotDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
  onSuccess?: (data: CreateBotData) => void;
}

export function BotDialog({
  open: openProp,
  onOpenChange,
  trigger,
  onSuccess,
}: BotDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen);
      } else {
        setInternalOpen(nextOpen);
      }
    },
    [isControlled, onOpenChange]
  );

  const [serverError, setServerError] = React.useState<string | null>(null);

  const defaultAvatarSeed = React.useMemo(() => nanoid(), []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      name: "",
      job: "",
      instructions: "",
      avatar: defaultAvatarSeed,
    },
  });

  const currentAvatar = watch("avatar");
  const currentJob = watch("job");

  const handleShuffle = React.useCallback(() => {
    setValue("avatar", nanoid(), { shouldValidate: true });
  }, [setValue]);

  const handleSelectTemplate = React.useCallback(
    (template: (typeof BOT_TEMPLATES)[number]) => {
      setValue("job", template.job, { shouldValidate: true });
      setValue("instructions", template.instructions, { shouldValidate: true });
      if (!getValues("name")) {
        setValue("name", template.name, { shouldValidate: true });
      }
    },
    [getValues, setValue]
  );

  const onSubmit = async (values: BotFormValues) => {
    setServerError(null);
    try {
      const result = await createBot({
        name: values.name,
        job: values.job,
        instructions: values.instructions || null,
        avatar: values.avatar,
      });

      if (result.success) {
        handleOpenChange(false);
        reset({
          name: "",
          job: "",
          instructions: "",
          avatar: nanoid(),
        });
        onSuccess?.(result.data);
      } else {
        setServerError(result.error);
      }
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to create bot"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[460px] gap-4 rounded-2xl border border-neutral-800 bg-[#18181b] p-5 sm:p-6 text-neutral-100 shadow-2xl ring-0">
        <DialogHeader className="gap-1 text-left">
          <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-white">
            New bot
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-neutral-400">
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>

        {/* Template Quick Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {BOT_TEMPLATES.map((tpl) => {
            const isSelected = currentJob === tpl.job;
            return (
              <button
                key={tpl.job}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer select-none",
                  isSelected
                    ? "border-neutral-600 bg-neutral-800 text-white shadow-xs"
                    : "border-neutral-800/80 bg-neutral-900/60 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white"
                )}
              >
                {tpl.job}
              </button>
            );
          })}
        </div>

        {/* Face Row */}
        <div className="flex items-center justify-between rounded-xl py-1">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-900/90 shadow-xs">
              <ChatAvatar
                seed={currentAvatar || "Ada"}
                width={44}
                height={44}
                className="size-11 rounded-xl object-cover"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-white">Face</span>
              <span className="text-xs text-neutral-400">
                Shuffle until you find one you like.
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShuffle}
            className="h-8 gap-1.5 rounded-lg border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium text-neutral-200 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white"
          >
            <Shuffle className="size-3.5" />
            Shuffle
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
          {/* Name Field */}
          <div className="flex flex-col gap-1.5 text-left">
            <Label htmlFor="bot-name" className="text-sm font-medium text-neutral-300">
              Name
            </Label>
            <Input
              id="bot-name"
              placeholder="Ada"
              {...register("name")}
              className="h-9 rounded-lg border-neutral-800 bg-neutral-900/80 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:border-neutral-600 focus-visible:ring-1 focus-visible:ring-neutral-600"
            />
            {errors.name && (
              <p className="text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          {/* Job Field */}
          <div className="flex flex-col gap-1.5 text-left">
            <Label htmlFor="bot-job" className="text-sm font-medium text-neutral-300">
              Job
            </Label>
            <Input
              id="bot-job"
              placeholder="Research assistant"
              {...register("job")}
              className="h-9 rounded-lg border-neutral-800 bg-neutral-900/80 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:border-neutral-600 focus-visible:ring-1 focus-visible:ring-neutral-600"
            />
            {errors.job && (
              <p className="text-xs text-red-400">{errors.job.message}</p>
            )}
          </div>

          {/* How it should work Field */}
          <div className="flex flex-col gap-1.5 text-left">
            <Label
              htmlFor="bot-instructions"
              className="text-sm font-medium text-neutral-300"
            >
              How it should work
            </Label>
            <Textarea
              id="bot-instructions"
              rows={3}
              placeholder="Answer briefly, cite sources, and ask before running anything destructive."
              {...register("instructions")}
              className="min-h-[88px] rounded-lg border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:border-neutral-600 focus-visible:ring-1 focus-visible:ring-neutral-600 resize-none"
            />
            {errors.instructions && (
              <p className="text-xs text-red-400">
                {errors.instructions.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
              {serverError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="h-8 rounded-lg px-3.5 text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <DynamicButton
              type="submit"
              variant="secondary"
              className="h-8 rounded-lg px-3.5 text-sm font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create bot"}
            </DynamicButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
