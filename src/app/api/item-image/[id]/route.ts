import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { available, deleteSetting, getSetting, putSetting } from "@/lib/store";

/**
 * One product photo, kept in the database next to the other settings and served
 * back as a normal image so the register can use it in an <img>. The till
 * shrinks it to the size of the register tile before uploading, so each is a
 * few tens of kilobytes. Signed-in staff only.
 *
 * The item list holds a versioned address (?v=…), so a replaced photo is a new
 * address and the browser's copy of the old one can be cached for good.
 */
const MAX = 200_000;
const ID = /^[a-z0-9-]{1,40}$/i;
const IMAGE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const key = (id: string) => `img-${id.toLowerCase()}`;

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: noStore });

function gate(request: Request, id: string, write: boolean) {
  if (!ID.test(id)) return fail("Bad item.", 400);
  if (write && !sameOrigin(request)) return fail("Bad origin.", 403);
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!available()) return fail("storage-not-configured", 503);
  return null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const blocked = gate(request, id, false);
  if (blocked) return blocked;
  try {
    const found = await getSetting<{ image: string }>(key(id));
    const m = found && IMAGE.exec(found.image);
    if (!m) return new NextResponse(null, { status: 404 });
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: {
        "content-type": `image/${m[1]}`,
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[stall] could not read item photo:", err);
    return fail("Could not load the photo.", 502);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const blocked = gate(request, id, true);
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
    return fail("Send a PNG, JPEG or WebP picture under about 150 KB.", 400);
  try {
    await putSetting(key(id), { image });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not save item photo:", err);
    return fail("Could not save the photo.", 502);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  const blocked = gate(request, id, true);
  if (blocked) return blocked;
  try {
    await deleteSetting(key(id));
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not remove item photo:", err);
    return fail("Could not remove the photo.", 502);
  }
}
