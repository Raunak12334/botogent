import { Daytona, type Sandbox } from '@daytona/sdk';

let daytonaClient: Daytona | null = null;

export function getDaytonaClient(): Daytona {
  if (!daytonaClient) {
    daytonaClient = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY,
      apiUrl: process.env.DAYTONA_API_URL || 'https://app.daytona.io/api',
      target: process.env.DAYTONA_TARGET || undefined,
    });
  }
  return daytonaClient;
}

export type CreateBotSandboxParams = {
  botId: string;
  name?: string;
  userId?: string;
};

/**
 * Creates a dedicated Daytona sandbox for a Bot without invoking, starting,
 * or executing commands inside it.
 */
export async function createBotSandbox(params: CreateBotSandboxParams): Promise<Sandbox> {
  const daytona = getDaytonaClient();

  const sandbox = await daytona.create({
    language: 'typescript',
    name: params.name ? `bot-${params.botId.slice(0, 8)}` : undefined,
    labels: {
      botId: params.botId,
      ...(params.userId ? { userId: params.userId } : {}),
    },
  });

  return sandbox;
}

/**
 * Deletes a Daytona sandbox by its ID.
 * Gracefully handles cases where the sandbox was already deleted or doesn't exist.
 */
export async function deleteBotSandbox(sandboxId: string): Promise<void> {
  if (!sandboxId) return;

  const daytona = getDaytonaClient();
  try {
    const sandbox = await daytona.get(sandboxId);
    if (sandbox) {
      await sandbox.delete();
    }
  } catch (error) {
    console.warn(
      `[Daytona] Warning during sandbox deletion (${sandboxId}):`,
      error instanceof Error ? error.message : error
    );
  }
}
