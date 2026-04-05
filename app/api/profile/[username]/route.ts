import { NextResponse } from "next/server";

const BASE = "https://api.sorsa.io/v3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: Record<string, any>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  try {
    const res = await fetch(
      `${BASE}/info?username=${encodeURIComponent(username)}`,
      {
        headers: { ApiKey: process.env.SORSA_API_KEY! },
        next: { revalidate: 300 },
      },
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw: unknown = await res.json();

    console.log("[profile] /info raw:", JSON.stringify(raw));

    if (!raw || typeof raw !== "object") throw new Error("Empty response");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = raw as Record<string, any>;

    // The real data might be nested under data / user / result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let src: Record<string, any> = obj;
    for (const key of ["data", "user", "result", "profile"]) {
      if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        src = obj[key];
        break;
      }
    }

    const name = String(
      pick(src, "name", "displayName", "display_name", "fullName", "full_name") ??
      username,
    ).trim() || username;

    const avatar = String(
      pick(src, "profileImageUrl", "profile_image_url", "profileImage",
           "profile_image", "avatar", "avatarUrl", "avatar_url", "photo") ?? "",
    ).trim().replace(/^http:\/\//i, "https://");

    const rawUsername = String(
      pick(src, "username", "handle", "screen_name", "userName") ?? username,
    ).replace(/^@/, "").trim() || username;

    return NextResponse.json({ name, username: rawUsername, avatar });
  } catch (err) {
    console.error("[profile] error:", err);
    // Return nulls — scan page falls back to generateDisplayName
    return NextResponse.json({ name: null, username, avatar: null });
  }
}
