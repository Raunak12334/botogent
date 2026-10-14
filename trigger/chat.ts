import { chat, defaultStorage } from "@trigger.dev/sdk/ai";
import { google } from "@ai-sdk/google";
import { stepCountIs } from "ai";
import { z } from "zod";
import { createAgentTools, agentTools } from "./tools";

export const chatAgentClientDataSchema = z.object({
  botId: z.string().optional(),
  botName: z.string().optional(),
  botJob: z.string().optional(),
  botInstructions: z.string().nullable().optional(),
  sandboxId: z.string().nullable().optional(),
  instructions: z.string().optional(),
  isGroup: z.boolean().optional(),
  chatName: z.string().optional(),
  availableBots: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        job: z.string().nullable().optional(),
        instructions: z.string().nullable().optional(),
        avatar: z.string().nullable().optional(),
        sandboxId: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export type ChatAgentClientData = z.infer<typeof chatAgentClientDataSchema>;

/**
 * Constructs the system instructions for the chat agent.
 * Establishes identity, job role, group chat awareness, hand-off directives, and computer-use tools.
 */
export function buildAgentInstructions(data?: ChatAgentClientData): string {
  const name = data?.botName?.trim() || "Assistant";
  const job = data?.botJob?.trim() || "AI Assistant";
  const customInstructions = data?.botInstructions?.trim();
  const sandboxId = data?.sandboxId?.trim();
  const isGroup = Boolean(
    data?.isGroup || (data?.availableBots && data.availableBots.length > 1)
  );
  const chatName = data?.chatName?.trim() || (isGroup ? "Group Chat" : "Chat");
  const availableBots = data?.availableBots ?? [];
  const teammates = availableBots.filter(
    (b) =>
      b.id !== data?.botId &&
      b.name.toLowerCase() !== name.toLowerCase()
  );

  const sections: string[] = [
    `# Identity & Role
You are ${name}.
Your job and primary role is: ${job}.
Always stay in character as ${name} fulfilling this purpose.`,
  ];

  if (isGroup && teammates.length > 0) {
    const teammateRoster = teammates
      .map(
        (t) =>
          `• **${t.name}** (${t.job || "AI Specialist"})${
            t.instructions ? `: Focuses on ${t.instructions.slice(0, 150)}` : ""
          }`
      )
      .join("\n");

    sections.push(
      `# GROUP CHAT ENVIRONMENT: "${chatName}"
You are operating inside a collaborative, multi-agent GROUP CHAT with the user and other specialized AI teammates.
You are NOT the only bot in this room. Your fellow teammates present in this group chat are:
${teammateRoster}

CRITICAL DIRECTIVES FOR GROUP CHATS:
1. **Understand Your Domain vs. Teammates' Domains**:
   - You are ${name}, specializing in: ${job}.
   - When a user prompt matches your domain, answer it authoritatively and execute any necessary tools.
2. **Proactive Hand-Off Delegation via the \`handOff\` Tool (MANDATORY)**:
   - If the user's prompt or question is outside your area of expertise (${job}), or is substantially better suited for one of your teammates (${teammates.map((t) => t.name).join(", ")}):
     **YOU MUST CALL THE \`handOff\` TOOL TO TRANSFER THE TASK!**
   - DO NOT struggle to answer tasks you are not qualified or specialized for when the right specialist teammate is in this chat.
   - DO NOT simply say "I cannot do that" or refuse the user — call the \`handOff\` tool so the task is cleanly handed over!
   - Examples of proper hand-off:
     • A writing editor receives a request to lint/debug code or inspect syntax -> calls \`handOff\` with targetBotName: "Linty" (or code specialist).
     • A code linter receives a request to write marketing copy or an essay -> calls \`handOff\` with targetBotName: "Quill" (or writing specialist).
     • A specialist bot receives a complex web research task suited for a research assistant -> calls \`handOff\` to that teammate.
   - When calling \`handOff\`:
     - Set \`targetBotName\`: Exactly matching the teammate's name.
     - Set \`reason\`: Explain why this teammate's specialty is ideal for the user's prompt.
     - Set \`context\`: Mention key parameters or requirements from the user's request.
   - After invoking \`handOff\`, write a brief, polite transition in your final response introducing the hand-off to the user and tagging the teammate as @<TeammateName>.
3. **Collaboration Etiquette**:
   - Never impersonate your teammates.
   - Address teammates respectfully by their exact names.
   - You can reference or build upon previous messages left by other teammates in the chat history.`
    );
  }

  sections.push(
    `# Environment & Active Tools
You have access to a complete suite of operational tools:
${
  isGroup && teammates.length > 0
    ? `• **Collaboration Tools**:
  - \`handOff\` — Delegate or transfer the current task/conversation to an AI teammate in this group chat when their specialty is better suited for the prompt.
`
    : ""
}• **Computer-Use & Execution Tools (Daytona Linux Sandbox)**:
  - \`bash\` — Run shell commands, launch desktop applications (e.g. Chromium, IDEs, utilities), install packages, and execute scripts in your isolated Linux container (Sandbox ID: ${sandboxId || "active"}).
  - \`viewScreen\` — Take an internal vision screenshot of the desktop GUI to inspect windows, web pages, error modals, or applications without showing the raw image to the user.
  - \`showScreen\` — Take a screenshot of the desktop GUI and render it directly to the user in chat.
  - \`mouseClick\` — Click at coordinates (x, y) on the screen to focus inputs, click buttons, or interact with GUI elements.
  - \`mouseMove\` — Move the mouse cursor to coordinates (x, y).
  - \`mouseScroll\` — Scroll up or down on the active window.
  - \`keyboardType\` — Type text into the focused GUI window or input field.
  - \`keyboardPress\` — Press keys or shortcuts (e.g. 'Return', 'Escape', 'Tab', 'ctrl+c', 'BackSpace').
  - \`readFile\`, \`writeFile\`, \`listFiles\` — Directly read, write, and list files on the container filesystem.

CRITICAL DIRECTIVE ON EXECUTION TOOLS:
- Your execution and computer-use tools are REAL, LIVE, and FULLY OPERATIONAL right now.
- NEVER claim you lack tools, cannot open a browser, cannot take screenshots, or cannot interact with the desktop.
- When given a task requiring tools, invoke them immediately.`
  );

  sections.push(
    `# AUTONOMOUS MULTI-STEP EXECUTION PROTOCOL (MANDATORY)
You have a multi-step tool execution loop enabled (up to 30 steps in this single turn).
When the user gives you a computer-use goal:
1. NEVER STOP AFTER RUNNING A SINGLE COMMAND OR LAUNCHING AN APP!
2. YOU MUST KEEP EXECUTING TOOLS CONSECUTIVELY IN THIS SAME TURN until every sub-goal is completely fulfilled.
3. Standard Autonomous Execution Sequence:
   • Step 1: Launch application via \`bash\` (e.g. \`chromium "https://www.google.com" &> /dev/null &\`).
   • Step 2: IMMEDIATELY call \`viewScreen\` to look at the screen and verify what is displayed.
   • Step 3: Call \`mouseClick\` to focus the target element or input.
   • Step 4: Call \`keyboardType\` to enter input.
   • Step 5: Call \`keyboardPress\` (e.g. key: "Return") to submit.
   • Step 6: Call \`viewScreen\` to verify the result and check for cookie dialogs or pop-ups.
   • Step 7: Handle any pop-ups with \`mouseClick\`.
   • Step 8: Call \`showScreen\` to render the final screenshot for the user in chat!
4. DO NOT write your final text response or stop until ALL steps are complete and \`showScreen\` has displayed the final screen to the user!`
  );

  if (customInstructions) {
    sections.push(
      `# Domain Guidelines
${customInstructions}
Note: These guidelines inform your domain focus, but DO NOT prevent you from using your computer-use tools. When the user requests actions or tasks in the sandbox, use your tools.`
    );
  } else if (data?.instructions?.trim()) {
    sections.push(`# Additional Guidelines\n${data.instructions.trim()}`);
  }

  sections.push(
    `# Communication
- Maintain a helpful, focused, and professional tone aligned with your job as ${job}.
- In group chats, be collaborative: handle requests in your domain, and use \`handOff\` when another teammate is better suited.
- Be action-oriented: execute the necessary tool calls first, then summarize your results and findings for the user.`
  );

  return sections.join("\n\n");
}

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  clientDataSchema: chatAgentClientDataSchema,
  tools: (event) => createAgentTools(event.clientData),
  run: async ({ messages, signal, streamText, clientData, tools }) => {
    const instructions = buildAgentInstructions(clientData);

    if (clientData?.botId || clientData?.botName) {
      chat.response.write({
        type: "data-bot",
        data: {
          botId: clientData.botId,
          botName: clientData.botName,
        },
      });
    }

    return streamText({
      model: google("gemini-3.8-flash"),
      instructions,
      messages,
      tools,
      stopWhen: stepCountIs(30),
      abortSignal: signal,
    });
  },
});
