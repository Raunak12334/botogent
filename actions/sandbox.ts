'use server';

import { auth } from '@clerk/nextjs/server';
import { getDaytonaClient } from '@/lib/daytona';

export type SandboxVncResult =
  | { success: true; url: string; directUrl?: string }
  | { success: false; error: string };

/**
 * Ensures the Daytona sandbox is started and the computerUse stack
 * (Xvfb, xfce4, x11vnc, novnc) is running, then mints a signed preview URL
 * for port 6080 (noVNC web client).
 */
export async function getSandboxVncUrl(sandboxId: string): Promise<SandboxVncResult> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: You must be signed in.' };
  }

  if (!sandboxId) {
    return { success: false, error: 'Sandbox ID is required.' };
  }

  try {
    const daytona = getDaytonaClient();
    const sandbox = await daytona.get(sandboxId);
    if (!sandbox) {
      return { success: false, error: `Sandbox "${sandboxId}" was not found.` };
    }

    // 1. Ensure the sandbox container itself is started and running
    if (sandbox.state !== 'started') {
      try {
        await sandbox.start();
        // Allow time for the container to acquire an IP address
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (startErr) {
        console.warn(`[Daytona] Warning during sandbox.start for ${sandboxId}:`, startErr);
      }
    }

    // 2. Ensure computerUse processes (Xvfb, xfce4, x11vnc, novnc) are active
    try {
      const status = await sandbox.computerUse.getStatus();
      if (status.status !== 'active') {
        await sandbox.computerUse.start();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch {
      try {
        await sandbox.computerUse.start();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (startErr) {
        console.warn(
          `[Daytona] Warning starting computerUse for sandbox ${sandboxId}:`,
          startErr instanceof Error ? startErr.message : startErr
        );
      }
    }

    // 3. Generate signed preview URL on port 6080 with 1 hour expiration
    const signedPreview = await sandbox.getSignedPreviewUrl(6080, 3600);
    const parsedUrl = new URL(signedPreview.url);
    const host = parsedUrl.host;
    const baseUrl = signedPreview.url.replace(/\/+$/, '');

    // Direct Daytona URL
    const directUrl = `${baseUrl}/vnc.html?autoconnect=true&resize=scale&reconnect=true`;

    // Proxied URL that injects X-Daytona-Skip-Preview-Warning to completely eliminate the warning page
    const proxiedVncUrl = `/api/sandbox-vnc/${host}/vnc.html?autoconnect=true&resize=scale&reconnect=true&host=${host}&port=443&encrypt=1&path=websockify`;

    return {
      success: true,
      url: proxiedVncUrl,
      directUrl,
    };
  } catch (error) {
    console.error(`[Daytona] Failed to get signed VNC URL for sandbox ${sandboxId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve Daytona VNC URL',
    };
  }
}
