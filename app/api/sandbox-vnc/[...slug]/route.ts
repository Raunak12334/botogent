import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return new NextResponse('Bad Request: Missing host parameter', { status: 400 });
  }

  const [host, ...rest] = slug;

  // Validate allowed proxy target domain to prevent open redirect/proxy abuse
  const isAllowedHost =
    host.endsWith('.daytonaproxy01.net') ||
    host.endsWith('.daytonaproxy.net') ||
    host.endsWith('.proxy.daytona.work') ||
    host.endsWith('.daytona.app');

  if (!isAllowedHost) {
    return new NextResponse('Forbidden: Invalid proxy target domain', { status: 403 });
  }

  const path = rest.join('/');
  const search = request.nextUrl.search;
  const targetUrl = `https://${host}/${path}${search}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'X-Daytona-Skip-Preview-Warning': 'true',
        'User-Agent': request.headers.get('user-agent') || 'Botogent/1.0',
        'Accept': request.headers.get('accept') || '*/*',
      },
      cache: 'no-store',
      redirect: 'follow',
    });

    const contentType =
      upstreamRes.headers.get('content-type') ||
      (path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.js')
        ? 'application/javascript'
        : path.endsWith('.svg')
        ? 'image/svg+xml'
        : path.endsWith('.json')
        ? 'application/json'
        : path.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : 'application/octet-stream');

    const body = await upstreamRes.arrayBuffer();

    return new NextResponse(body, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error(`[VNC Proxy] Error proxying to ${targetUrl}:`, err);
    return new NextResponse(
      err instanceof Error ? err.message : 'Upstream proxy connection failed',
      { status: 502 }
    );
  }
}
