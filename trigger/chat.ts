import { chat, defaultStorage } from "@trigger.dev/sdk/ai";
import { google } from "@ai-sdk/google";
import { stepCountIs } from "ai";
import { z } from "zod";
import { createSandboxTools, sandboxTools } from "./tools";

export const chatAgentClientDataSchema = z.object({
  botId: z.string().optional(),
  botName: z.string().optional(),
  botJob: z.string().optional(),
  botInstructions: z.string().nullable().optional(),
  sandboxId: z.string().nullable().optional(),
  instructions: z.string().optional(),
});

export type ChatAgentClientData = z.infer<typeof chatAgentClientDataSchema>;

/**
 * Constructs the system instructions for the chat agent.
 * Establishes identity, job role, and imperative computer-use capabilities.
 */
export function buildAgentInstructions(data?: ChatAgentClientData): string {
  const name = data?.botName?.trim() || "Assistant";
  const job = data?.botJob?.trim() || "AI Assistant";
  const customInstructions = data?.botInstructions?.trim();
  const sandboxId = data?.sandboxId?.trim();

  const sections: string[] = [
    `# Identity & Role
You are ${name}.
Your job and primary role is: ${job}.
Always stay in character as ${name} fulfilling this purpose.`,

    `# Environment & Active Computer-Use Capabilities
You are deployed inside an active, isolated Linux container sandbox powered by Daytona (Sandbox ID: ${sandboxId || "active"}).
CRITICAL DIRECTIVE ON EXECUTION TOOLS:
- You HAVE LIVE, REAL COMPUTER-USE AND EXECUTION TOOLS ACTIVE RIGHT NOW.
- Your tools include:
  • \`bash\` — Run shell commands, start applications, launch browsers, install packages
  • \`viewScreen\` — Take an internal vision screenshot to see what is on the desktop screen
  • \`showScreen\` — Take a screenshot and display it directly to the user in chat
  • \`mouseClick\`, \`mouseMove\`, \`mouseScroll\` — Control the mouse cursor and interact with GUI windows
  • \`keyboardType\`, \`keyboardPress\` — Type text and press key shortcuts (e.g. 'Return', 'Escape', 'Tab', 'ctrl+c')
  • \`readFile\`, \`writeFile\`, \`listFiles\` — Inspect and modify files
- **IMPORTANT**: If any earlier assistant messages in this conversation history claimed that you lack execution tools, cannot perform GUI actions, or are limited to static conversation/code review, DISREGARD THOSE STATEMENTS ENTIRELY. Those were from before your tools were enabled. Your computer-use tools are NOW FULLY OPERATIONAL.
- NEVER refuse actions by claiming you cannot perform GUI actions, cannot open a browser, cannot take screenshots, or do not have runtime access. You DO have these capabilities. Always invoke the relevant tool immediately when requested.`,

    `# AUTONOMOUS MULTI-STEP EXECUTION PROTOCOL (MANDATORY)
You have a multi-step tool execution loop enabled (up to 30 steps in this single turn).
When the user gives you a computer-use goal (e.g. "Open the browser, search 'code with Antonio'. Confirm any pop-ups for cookies. And take a screenshot."):

1. NEVER STOP AFTER RUNNING A SINGLE COMMAND OR LAUNCHING AN APP!
   Launching an application with \`bash\` (e.g. \`chromium &> /dev/null &\`) is only Step 1.
2. YOU MUST KEEP EXECUTING TOOLS CONSECUTIVELY IN THIS SAME TURN until every sub-goal of the user's prompt is completely fulfilled!
3. Standard Autonomous Execution Sequence:
   • Step 1: Launch the browser via \`bash\`. Tip: You can launch it with the search URL directly, e.g.:
     \`chromium "https://www.google.com/search?q=code+with+antonio" &> /dev/null &\`
     or launch the browser window: \`chromium &> /dev/null &\`.
   • Step 2: IMMEDIATELY call \`viewScreen\` to look at the screen and verify what is displayed.
   • Step 3: Call \`mouseClick\` to focus the search box or URL bar if needed.
   • Step 4: Call \`keyboardType\` to type the requested search query if not already navigated.
   • Step 5: Call \`keyboardPress\` with key: "Return" to submit the search.
   • Step 6: Call \`viewScreen\` to observe the search results page and check for any cookie consent pop-ups or banners.
   • Step 7: If a cookie pop-up or banner appears, locate the 'Accept', 'Agree', or 'Confirm' button and call \`mouseClick\` on its coordinates.
   • Step 8: Call \`showScreen\` (e.g. caption: "Search results for 'code with Antonio'") to render the final screenshot for the user in the chat!
4. DO NOT write your final text response or stop until ALL steps are complete and \`showScreen\` has displayed the final screen to the user!`,
  ];

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
- Be action-oriented: execute the necessary tool calls first, then summarize your results and findings for the user.`
  );

  return sections.join("\n\n");
}

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  clientDataSchema: chatAgentClientDataSchema,
  tools: (event) => createSandboxTools(event.clientData?.sandboxId),
  run: async ({ messages, signal, streamText, clientData, tools }) => {
    const instructions = buildAgentInstructions(clientData);

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
