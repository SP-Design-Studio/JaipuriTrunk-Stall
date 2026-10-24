import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { available, deleteSetting, getSetting, putSetting } from "@/lib/store";

/**
 * The stall's UPI QR, uploaded by staff and kept in the database so no iPad
 * holds the only copy. Stored as a small data URL: a QR picture is tens of
 * kilobytes once the till has shrunk it, and a data URL needs no file storage.
 * Signed-in staff only, and only images are accepted.
 */
const KEY = "upi-qr";
const MAX = 450_000;
const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: noStore });

function gate(request: Request, write: boolean) {
  if (write && !sameOrigin(request)) return fail("Bad origin.", 403);
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!available()) return fail("storage-not-configured", 503);
  return null;
}

export async function GET(request: Request) {
  const blocked = gate(request, false);
  if (blocked) return blocked;
  try {
    const found = await getSetting<{ image: string }>(KEY);
    return NextResponse.json(
      { image: found?.image ?? null },
      { headers: noStore },
    );
  } catch (err) {
    console.error("[stall] could not read the QR:", err);
    return fail("Could not load the QR.", 502);
  }
}

export async function PUT(request: Request) {
  const blocked = gate(request, true);
  if (blocked) return blocked;
  if (!request.headers.get("content-type")?.includes("application/json"))
    return fail("Send JSON.", 415);
  let body: { image?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Malformed request.", 400);
  }
  const image = body.image;
  if (typeof image !== "string" || image.length > MAX || !IMAGE.test(image))
    return fail("Send a PNG, JPEG or WebP picture under about 300 KB.", 400);
  try {
    await putSetting(KEY, { image });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not save the QR:", err);
    return fail("Could not save the QR.", 502);
  }
}

export async function DELETE(request: Request) {
  const blocked = gate(request, true);
  if (blocked) return blocked;
  try {
    await deleteSetting(KEY);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not remove the QR:", err);
    return fail("Could not remove the QR.", 502);
  }
}
