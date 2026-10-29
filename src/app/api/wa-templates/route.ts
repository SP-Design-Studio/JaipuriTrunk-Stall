import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { MAX_TEMPLATE } from "@/lib/messages";
import { available, deleteSetting, getSetting, putSetting } from "@/lib/store";

/** The WhatsApp message wording, edited in Settings. Staff only. */
const KEY = "wa-templates";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: noStore });

export async function GET(request: Request) {
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!available()) return fail("storage-not-configured", 503);
  try {
    const found = await getSetting<{
      receipt: string;
      followUp: string;
      reviewAsk?: string;
    }>(KEY);
    return NextResponse.json({ templates: found }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not read templates:", err);
    return fail("Could not load the messages.", 502);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return fail("Bad origin.", 403);
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return fail("Send JSON.", 415);
  let body: { receipt?: unknown; followUp?: unknown; reviewAsk?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Malformed request.", 400);
  }
  const ok = (v: unknown): v is string =>
    typeof v === "string" && v.trim().length > 0 && v.length <= MAX_TEMPLATE;
  if (
    !ok(body.receipt) ||
    !ok(body.followUp) ||
    (body.reviewAsk !== undefined && !ok(body.reviewAsk))
  )
    return fail(
      `Each message needs some text, up to ${MAX_TEMPLATE} characters.`,
      400,
    );
  if (!available()) return fail("storage-not-configured", 503);
  try {
    await putSetting(KEY, {
      receipt: body.receipt,
      followUp: body.followUp,
      ...(body.reviewAsk !== undefined ? { reviewAsk: body.reviewAsk } : {}),
    });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not save templates:", err);
    return fail("Could not save the messages.", 502);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail("Bad origin.", 403);
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!available()) return fail("storage-not-configured", 503);
  try {
    await deleteSetting(KEY);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not reset templates:", err);
    return fail("Could not reset the messages.", 502);
  }
}
