/**
 * Daytona Linux sandbox computer-use tools.
 *
 * Each tool maps to a Daytona SDK operation.
 * Supports lazy binding of `sandboxId` from Trigger.dev `clientData` per-turn,
 * while also allowing the model to optionally pass `sandboxId`.
 */

import { tool } from "ai";
import { z } from "zod";
import { chat } from "@trigger.dev/sdk/ai";
import { getDaytonaClient } from "@/lib/daytona";
import type { Sandbox } from "@daytona/sdk";

// ---------------------------------------------------------------------------
// Helpers & Computer-Use Daemon Lifecycle
// ---------------------------------------------------------------------------

async function getSandbox(sandboxId: string) {
  const client = getDaytonaClient();
  const sandbox = await client.get(sandboxId);
  if (!sandbox) throw new Error(`Daytona sandbox ${sandboxId} not found`);

  // Ensure the sandbox container itself is started and has an active IP
  if (sandbox.state !== "started") {
    try {
      await sandbox.start();
      // Allow time for the container to acquire an IP address and initialize
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (startErr) {
      console.warn(
        `[Daytona] Warning during sandbox.start for ${sandboxId}:`,
        startErr instanceof Error ? startErr.message : startErr
      );
    }
  }

  return sandbox;
}

// Track sandboxes where computerUse services (Xvfb, XFCE4, VNC, etc.) have been verified active
const runningSandboxes = new Set<string>();

/**
 * Ensures that the sandbox's desktop GUI and computerUse processes
 * (Xvfb, xfce4, x11vnc, novnc) are running before executing GUI actions.
 */
async function ensureComputerUse(sandbox: Sandbox, force = false): Promise<void> {
  if (!force && runningSandboxes.has(sandbox.id)) return;

  try {
    const status = await sandbox.computerUse.getStatus();
    if (status.status !== "active" && status.status !== "running") {
      await sandbox.computerUse.start();
      await new Promise((r) => setTimeout(r, 1000));
    }
    runningSandboxes.add(sandbox.id);
  } catch {
    try {
      await sandbox.computerUse.start();
      await new Promise((r) => setTimeout(r, 1000));
      runningSandboxes.add(sandbox.id);
    } catch (startErr) {
      console.warn(
        `[Daytona] computerUse.start warning for sandbox ${sandbox.id}:`,
        startErr instanceof Error ? startErr.message : startErr
      );
    }
  }
}

/**
 * Creates sandbox tools bound to an optional default sandboxId.
 * The model does NOT need to guess or supply sandboxId on tool calls.
 */
export function createSandboxTools(boundSandboxId?: string | null) {
  const resolveSandbox = async (providedId?: string) => {
    const id = providedId || boundSandboxId;
    if (!id) {
      throw new Error(
        "No Daytona sandbox ID assigned to this bot. Cannot execute sandbox tool."
      );
    }
    return getSandbox(id);
  };

  const captureScreen = async (providedId?: string) => {
    const sandbox = await resolveSandbox(providedId);
    await ensureComputerUse(sandbox);

    let shot;
    try {
      shot = await sandbox.computerUse.screenshot.takeCompressed({
        format: "jpeg",
        quality: 80,
        scale: 0.8,
      });
    } catch (firstErr) {
      // If first attempt failed, re-initialize desktop and retry once
      console.warn(
        `[Daytona] First screenshot attempt failed, retrying after ensureComputerUse:`,
        firstErr instanceof Error ? firstErr.message : firstErr
      );
      await ensureComputerUse(sandbox, true);
      shot = await sandbox.computerUse.screenshot.takeCompressed({
        format: "jpeg",
        quality: 80,
        scale: 0.8,
      });
    }

    return {
      dataUri: `data:image/jpeg;base64,${shot.screenshot ?? ""}`,
      base64: shot.screenshot ?? "",
      sizeBytes: shot.sizeBytes ?? 0,
    };
  };

  // -------------------------------------------------------------------------
  // Bash / Shell
  // -------------------------------------------------------------------------
  const bash = tool({
    description:
      "Run a shell command in the Daytona Linux sandbox. Returns stdout and exit code. " +
      "Use for installing packages, launching GUI apps (e.g. `chromium &> /dev/null &`), running scripts, and checking files.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to execute"),
      cwd: z.string().optional().describe("Working directory override"),
      timeout: z.number().optional().describe("Max seconds to wait"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ command, sandboxId, cwd, timeout }) => {
      const sandbox = await resolveSandbox(sandboxId);
      if (
        command.includes("chromium") ||
        command.includes("chrome") ||
        command.includes("DISPLAY") ||
        command.includes("xdotool")
      ) {
        await ensureComputerUse(sandbox);
      }
      const response = await sandbox.process.executeCommand(
        command,
        cwd,
        undefined,
        timeout
      );
      return {
        stdout: response.result ?? "",
        exitCode: response.exitCode,
        nextStepRecommendation:
          "Command executed. Call viewScreen to inspect the desktop and locate UI elements, or proceed with next tool call.",
      };
    },
  });

  // -------------------------------------------------------------------------
  // File System
  // -------------------------------------------------------------------------
  const readFile = tool({
    description:
      "Read the contents of a file in the sandbox filesystem as a UTF-8 string. " +
      "Use this to inspect files or read 'memory.md' (your persistent long-term memory storing facts, user preferences, and history across 1-on-1 and group chats).",
    inputSchema: z.object({
      path: z.string().describe("Absolute or relative path to the file (e.g. 'memory.md')"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ path, sandboxId }) => {
      const sandbox = await resolveSandbox(sandboxId);
      try {
        const bytes = await sandbox.fs.downloadFile(path);
        return { content: bytes.toString("utf-8") };
      } catch (err) {
        // If memory.md does not exist yet (e.g. bot created before this update), initialize a blank memory.md
        if (
          path === "memory.md" ||
          path === "/home/daytona/memory.md" ||
          path.endsWith("/memory.md")
        ) {
          try {
            await sandbox.fs.uploadFile(Buffer.from(""), "memory.md");
            return { content: "" };
          } catch (createErr) {
            console.warn(
              "[Daytona] Could not initialize fallback memory.md:",
              createErr instanceof Error ? createErr.message : createErr
            );
            return { content: "" };
          }
        }
        throw err;
      }
    },
  });

  const writeFile = tool({
    description:
      "Write text content to a file in the sandbox filesystem. " +
      "Use this to update files or persist notes to 'memory.md' (so facts and preferences learned in private 1-on-1 chats are remembered when asked in group chats).",
    inputSchema: z.object({
      path: z.string().describe("Absolute or relative path to the file (e.g. 'memory.md')"),
      content: z.string().describe("Text content to write"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ path, content, sandboxId }) => {
      const sandbox = await resolveSandbox(sandboxId);
      try {
        await sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), path);
      } catch (uploadErr) {
        // If container needed extra time to resolve IP or start, retry once
        if (sandbox.state !== "started") {
          await sandbox.start();
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
        await sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), path);
      }
      return { success: true, path };
    },
  });

  const listFiles = tool({
    description:
      "List files and directories at a given path in the sandbox.",
    inputSchema: z.object({
      path: z
        .string()
        .default("/home/daytona")
        .describe("Directory path to list"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ path, sandboxId }) => {
      const sandbox = await resolveSandbox(sandboxId);
      const files = await sandbox.fs.listFiles(path);
      return {
        path,
        entries: files.map(
          (f: { name: string; isDir?: boolean; size?: number }) => ({
            name: f.name,
            type: f.isDir ? "directory" : "file",
            size: f.isDir ? undefined : f.size,
          })
        ),
      };
    },
  });

  // -------------------------------------------------------------------------
  // Mouse
  // -------------------------------------------------------------------------
  const mouseClick = tool({
    description:
      "Click the mouse at a specific (x, y) coordinate on the sandbox desktop. Supports left, right, middle buttons, and double-click.",
    inputSchema: z.object({
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      button: z
        .enum(["left", "right", "middle"])
        .default("left")
        .describe("Mouse button"),
      double: z.boolean().default(false).describe("Whether to double-click"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ x, y, button, double: dbl, sandboxId }) => {
      const sandbox = await resolveSandbox(sandboxId);
      await ensureComputerUse(sandbox);
      const result = await sandbox.computerUse.mouse.click(x, y, button, dbl);
      return {
        x: result.x,
        y: result.y,
        button,
        double: dbl,
        nextStepRecommendation:
          "Click performed. Call viewScreen to verify updated state or keyboardType to input text.",
      };
    },
  });

  const mouseMove = tool({
    description:
      "Move the mouse cursor to a specific (x, y) coordinate on the sandbox desktop.",
    inputSchema: z.object({
      x: z.number().describe("X coordinate to move to"),
      y: z.number().describe("Y coordinate to move to"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ x, y, sandboxId }) => {
      const sandbox = await resolveSandbox(sandboxId);
      await ensureComputerUse(sandbox);
      const result = await sandbox.computerUse.mouse.move(x, y);
      return { x: result.x, y: result.y };
    },
  });

  const mouseScroll = tool({
    description:
      "Scroll the mouse wheel at a specific (x, y) coordinate on the sandbox desktop.",
    inputSchema: z.object({
      x: z.number().describe("X coordinate to scroll at"),
      y: z.number().describe("Y coordinate to scroll at"),
      direction: z.enum(["up", "down"]).describe("Scroll direction"),
      amount: z.number().default(3).describe("Number of scroll units"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ x, y, direction, amount, sandboxId }) => {
      const sandbox = await resolveSandbox(sandboxId);
      await ensureComputerUse(sandbox);
      const ok = await sandbox.computerUse.mouse.scroll(
        x,
        y,
        direction,
        amount
      );
      return { success: ok, x, y, direction, amount };
    },
  });

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------
  const keyboardType = tool({
    description:
      "Type text into the sandbox desktop via keyboard input into the focused window/field.",
    inputSchema: z.object({
      text: z.string().describe("Text to type"),
      delay: z
        .number()
        .optional()
        .describe("Delay between characters in milliseconds"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ text, delay, sandboxId }) => {
      const sandbox = await resolveSandbox(sandboxId);
      await ensureComputerUse(sandbox);
      await sandbox.computerUse.keyboard.type(text, delay);
      return {
        success: true,
        typed: text,
        nextStepRecommendation:
          "Text typed. Call keyboardPress with 'Return' to submit or viewScreen to inspect.",
      };
    },
  });

  const keyboardPress = tool({
    description:
      "Press a key or key combination in the sandbox desktop (e.g. 'Return', 'Escape', 'Tab', or 'ctrl+c').",
    inputSchema: z.object({
      hotkey: z
        .string()
        .optional()
        .describe("Hotkey chord e.g. 'ctrl+c', 'alt+tab', 'Return'"),
      key: z
        .string()
        .optional()
        .describe("Single key e.g. 'enter', 'escape', 'tab'"),
      modifiers: z
        .array(z.enum(["ctrl", "alt", "shift", "cmd"]))
        .optional()
        .describe("Modifier keys (used with `key`)"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ hotkey, key, modifiers, sandboxId }) => {
      const sandbox = await resolveSandbox(sandboxId);
      await ensureComputerUse(sandbox);
      if (hotkey) {
        await sandbox.computerUse.keyboard.hotkey(hotkey);
        return {
          success: true,
          hotkey,
          nextStepRecommendation:
            "Key pressed. Call viewScreen to inspect updated screen state.",
        };
      }
      if (key) {
        await sandbox.computerUse.keyboard.press(key, modifiers);
        return {
          success: true,
          key,
          modifiers,
          nextStepRecommendation:
            "Key pressed. Call viewScreen to inspect updated screen state.",
        };
      }
      throw new Error("Provide either `hotkey` or `key`");
    },
  });

  // -------------------------------------------------------------------------
  // Screen Capture
  // -------------------------------------------------------------------------
  const viewScreen = tool({
    description:
      "Take a screenshot of the sandbox desktop for internal agent vision. " +
      "Call this to inspect the screen and locate coordinates before clicking or typing.",
    inputSchema: z.object({
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ sandboxId }) => captureScreen(sandboxId),
    toModelOutput: ({ output }) => ({
      type: "content" as const,
      value: [
        {
          type: "file" as const,
          mediaType: "image/jpeg" as const,
          data: { type: "data" as const, data: output.base64 },
        },
        {
          type: "text" as const,
          text: "Screen image captured. Analyze the screenshot to locate coordinates for mouseClick or input fields for keyboardType. Call showScreen when ready to show results to user.",
        },
      ],
    }),
  });

  const showScreen = tool({
    description:
      "Take a screenshot of the sandbox desktop and display it to the user in the chat.",
    inputSchema: z.object({
      caption: z
        .string()
        .optional()
        .describe("Optional caption to display with the screenshot"),
      sandboxId: z.string().optional().describe("Optional sandbox ID override"),
    }),
    execute: async ({ sandboxId, caption }) => {
      const shot = await captureScreen(sandboxId);
      return { ...shot, caption };
    },
    toModelOutput: ({ output }) => ({
      type: "content" as const,
      value: [
        {
          type: "file" as const,
          mediaType: "image/jpeg" as const,
          data: { type: "data" as const, data: output.base64 },
        },
        ...(output.caption
          ? [{ type: "text" as const, text: output.caption }]
          : []),
      ],
    }),
  });

  return {
    bash,
    readFile,
    writeFile,
    listFiles,
    mouseClick,
    mouseMove,
    mouseScroll,
    keyboardType,
    keyboardPress,
    viewScreen,
    showScreen,
  };
}

export const sandboxTools = createSandboxTools();
export type SandboxTools = ReturnType<typeof createSandboxTools>;

// ---------------------------------------------------------------------------
// Group Chat Collaboration & Hand-Off Tool
// ---------------------------------------------------------------------------

export type HandOffAvailableBot = {
  id: string;
  name: string;
  job?: string | null;
  instructions?: string | null;
  avatar?: string | null;
  sandboxId?: string | null;
};

export type HandOffToolOptions = {
  currentBotId?: string;
  currentBotName?: string;
  availableBots?: HandOffAvailableBot[];
  onHandOff?: (event: {
    fromBotId?: string;
    fromBotName?: string;
    targetBotId: string;
    targetBotName: string;
    targetBotJob?: string;
    targetBotAvatar?: string;
    reason: string;
    context?: string;
  }) => void;
};

export function createHandOffTool(options?: HandOffToolOptions) {
  const currentBotId = options?.currentBotId;
  const currentBotName = options?.currentBotName || "Assistant";
  const availableBots = options?.availableBots ?? [];

  const teammates = availableBots.filter(
    (b) =>
      b.id !== currentBotId &&
      b.name.toLowerCase() !== currentBotName.toLowerCase()
  );

  const teammateNames = teammates.map((b) => b.name);
  const teammateListStr =
    teammates.length > 0
      ? teammates
          .map((b) => `• "${b.name}" (${b.job || "AI Specialist"})`)
          .join(", ")
      : "No other teammates registered in this chat";

  return tool({
    description:
      `Delegate or hand off the current task/conversation to another AI teammate in this group chat if the user's prompt is outside your domain and better suited for them. ` +
      `Available teammates in this group chat: ${teammateListStr}.`,
    inputSchema: z.object({
      targetBotName: z
        .string()
        .describe(
          `The exact name of the teammate to hand off to. Must match one of: ${
            teammateNames.length > 0 ? teammateNames.join(", ") : "None"
          }`
        ),
      reason: z
        .string()
        .describe(
          "Clear explanation of why this teammate is better suited for the user's request (e.g. domain expertise, specific task requirements)"
        ),
      context: z
        .string()
        .optional()
        .describe(
          "Summary of the user's prompt, requirements, or progress so far for the target teammate to reference"
        ),
    }),
    execute: async ({ targetBotName, reason, context }) => {
      const cleanTargetName = targetBotName.trim();
      const target = teammates.find(
        (b) =>
          b.name.toLowerCase() === cleanTargetName.toLowerCase() ||
          cleanTargetName.toLowerCase().includes(b.name.toLowerCase()) ||
          b.name.toLowerCase().includes(cleanTargetName.toLowerCase())
      );

      if (!target) {
        return {
          success: false,
          error: `Teammate "${targetBotName}" was not found in this group chat. Valid teammates are: ${
            teammateNames.length > 0 ? teammateNames.join(", ") : "None"
          }`,
        };
      }

      const handoffEvent = {
        fromBotId: currentBotId,
        fromBotName: currentBotName,
        targetBotId: target.id,
        targetBotName: target.name,
        targetBotJob: target.job ?? undefined,
        targetBotAvatar: target.avatar ?? target.name,
        reason,
        context,
      };

      if (options?.onHandOff) {
        try {
          options.onHandOff(handoffEvent);
        } catch (err) {
          console.warn("[handOff] onHandOff callback error:", err);
        }
      }

      return {
        success: true,
        targetBotId: target.id,
        targetBotName: target.name,
        targetBotJob: target.job || "Specialist",
        targetBotAvatar: target.avatar || target.name,
        fromBotName: currentBotName,
        reason,
        context: context || "Task handed off to specialist teammate.",
        message: `Task successfully handed off to ${target.name} (${target.job || "Specialist"}). You should now briefly and courteously introduce the hand-off to the user in your response, addressing the teammate as @${target.name}.`,
      };
    },
  });
}

export type AgentToolsOptions = {
  sandboxId?: string | null;
  botId?: string;
  botName?: string;
  isGroup?: boolean;
  availableBots?: HandOffAvailableBot[];
};

export function createAgentTools(options?: AgentToolsOptions) {
  const sandbox = createSandboxTools(options?.sandboxId);
  const isGroup =
    Boolean(options?.isGroup) ||
    Boolean(options?.availableBots && options.availableBots.length > 1);

  const availableBots = options?.availableBots ?? [];
  const teammates = availableBots.filter(
    (b) =>
      b.id !== options?.botId &&
      b.name.toLowerCase() !== (options?.botName || "").toLowerCase()
  );

  if (isGroup && teammates.length > 0) {
    const handOff = createHandOffTool({
      currentBotId: options?.botId,
      currentBotName: options?.botName,
      availableBots: options?.availableBots,
      onHandOff: (event) => {
        try {
          chat.response.write({
            type: "data-handoff",
            data: event,
          });
        } catch (err) {
          console.warn("[createAgentTools] chat.response.write warning:", err);
        }
      },
    });

    return {
      ...sandbox,
      handOff,
    };
  }

  const fallbackHandOff = createHandOffTool();
  return {
    ...sandbox,
    handOff: fallbackHandOff,
  };
}

export const agentTools = createAgentTools();
export type AgentTools = ReturnType<typeof createAgentTools>;
