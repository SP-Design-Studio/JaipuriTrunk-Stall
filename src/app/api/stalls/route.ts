import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { available, getSetting, putSetting } from "@/lib/store";
import { STALL_LIMITS, parseStall } from "@/lib/validate";
import type { StallEntry } from "@/lib/types";

/**
 * The list of stalls staff pick from when they start selling, edited in
 * Settings. Kept with the other small settings. Staff only.
 */
const KEY = "stalls";
const ID = /^[a-z0-9-]{1,40}$/i;

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: noStore });

export async function GET(request: Request) {
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!available()) return fail("storage-not-configured", 503);
  try {
    const found = await getSetting<{
      stalls: StallEntry[];
      currentId?: string | null;
    }>(KEY);
    return NextResponse.json(
      { stalls: found?.stalls ?? [], currentId: found?.currentId ?? null },
      { headers: noStore },
    );
  } catch (err) {
    console.error("[stall] could not read stalls:", err);
    return fail("Could not load the stalls.", 502);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return fail("Bad origin.", 403);
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return fail("Send JSON.", 415);
  let body: { stalls?: unknown; currentId?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Malformed request.", 400);
  }
  if (!Array.isArray(body.stalls) || body.stalls.length > STALL_LIMITS.count)
    return fail(`Up to ${STALL_LIMITS.count} stalls.`, 400);
  const stalls: StallEntry[] = [];
  const seen = new Set<string>();
  const names = new Set<string>();
  for (const raw of body.stalls) {
    const id = (raw as { id?: unknown })?.id;
    const stall = parseStall(raw);
    if (typeof id !== "string" || !ID.test(id) || seen.has(id) || !stall)
      return fail("Each stall needs a name and valid days.", 400);
    // Bills are matched to a stall by its name, so two cannot share one.
    if (names.has(stall.name.toLowerCase()))
      return fail("Two stalls have the same name.", 400);
    seen.add(id);
    names.add(stall.name.toLowerCase());
    stalls.push({ id, ...stall });
  }
  const currentId = body.currentId ?? null;
  if (
    currentId !== null &&
    (typeof currentId !== "string" || !seen.has(currentId))
  )
    return fail("The current stall must be one in the list.", 400);
  if (!available()) return fail("storage-not-configured", 503);
  try {
    await putSetting(KEY, { stalls, currentId });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not save stalls:", err);
    return fail("Could not save the stalls.", 502);
  }
}
