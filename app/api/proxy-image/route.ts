import { NextResponse } from "next/server";

/**
 * GET /api/proxy-image?url=<encoded-image-url>
 *
 * Server-side image proxy used by the share card download flow.
 * The browser cannot fetch Twitter/X avatar URLs directly due to CORS, so we
 * pipe the image through this route and return it with permissive headers.
 * The client can then convert the response to a base64 data URL and embed it
 * in the html-to-image capture before CORS restrictions apply.
 *
 * Security: only HTTP/HTTPS URLs are accepted; the route is read-only.
 * Cache: responses are cached for 1 hour to avoid redundant origin fetches.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Only allow plain HTTP(S) URLs — no data: or javascript: URIs.
  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
    if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
      return new NextResponse("Only http(s) URLs are allowed", { status: 400 });
    }
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        // Mimic a browser request so CDNs don't block us.
        "User-Agent":
          "Mozilla/5.0 (compatible; FollowSignal/1.0; +https://followsignal.app)",
      },
      // Next.js fetch cache: reuse the same image for 1 hour across requests.
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return new NextResponse("Upstream fetch failed", { status: upstream.status });
    }

    const buffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Allow the browser to use this response in a canvas / html-to-image.
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err) {
    console.error("[proxy-image] fetch error:", err);
    return new NextResponse("Failed to fetch image", { status: 502 });
  }
}
