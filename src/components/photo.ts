/**
 * Shrinks a product photo to the register tile: a square, drawn at about twice
 * the tile's on-screen size so it stays sharp on the iPad's Retina screen. The
 * whole picture is kept (fitted, not cropped) on white, as the tiles show it.
 */
export const TILE_PX = 360;

export async function tilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That isn’t a picture.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(TILE_PX / bitmap.width, TILE_PX / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t read that picture.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.drawImage(bitmap, (TILE_PX - w) / 2, (TILE_PX - h) / 2, w, h);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  if (url.length > 190_000) throw new Error("That picture is too large.");
  return url;
}

/** Uploads the shrunk photo; resolves to the address to store on the item. */
export async function uploadItemPhoto(itemId: string, file: File) {
  const image = await tilePhoto(file);
  const res = await fetch(`/api/item-image/${itemId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error ?? "Couldn’t save the photo.");
  }
  return `/api/item-image/${itemId}?v=${Date.now()}`;
}

export const deleteItemPhoto = (itemId: string) =>
  fetch(`/api/item-image/${itemId}`, { method: "DELETE" }).catch(() => {});
