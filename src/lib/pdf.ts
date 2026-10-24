/**
 * PDFs made of JPEG pages, written by hand.
 *
 * The receipt is already drawn as an image (that is what the PNG is), so the PDF
 * is that same picture on a page. A library would add a few hundred kilobytes to
 * the till to do what is, for this, about fifty lines: a PDF is a handful of
 * numbered objects, an index of where each one starts, and a trailer pointing at
 * the index.
 *
 * The consequence of embedding images: the text in the PDF is not selectable.
 * For a receipt that is the right trade — it looks identical everywhere and
 * cannot reflow — and the machine-readable record is the sale in the database.
 */
export type PdfPage = {
  jpeg: Uint8Array;
  /** The JPEG's pixel size. */
  widthPx: number;
  heightPx: number;
  /** The page's size in points (1/72 inch). The image fills it. */
  pageW: number;
  pageH: number;
};

export function imagesToPdf(pages: PdfPage[], title: string): Blob {
  const enc = new TextEncoder();
  // PDF strings are Latin-1 here; anything else would need escaping, and a
  // title made of a bill number or a date never contains it.
  const safeTitle = title.replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "");

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const text = (s: string) => push(enc.encode(s));
  const object = (n: number, head: string, body?: Uint8Array) => {
    offsets[n] = length;
    text(`${n} 0 obj\n${head}\n`);
    if (body) {
      text("stream\n");
      push(body);
      text("\nendstream\n");
    }
    text("endobj\n");
  };

  // 1 catalog, 2 page tree, 3 info; then three objects per page (page, image,
  // content stream).
  const first = (i: number) => 4 + i * 3;
  text("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${first(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  object(3, `<< /Title (${safeTitle}) /Producer (JaipuriTrunk-Stall) >>`);
  pages.forEach((p, i) => {
    const w = round(p.pageW);
    const h = round(p.pageH);
    const content = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
    object(
      first(i),
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${first(i) + 1} 0 R >> >> /Contents ${first(i) + 2} 0 R >>`,
    );
    object(
      first(i) + 1,
      `<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`,
      p.jpeg,
    );
    object(first(i) + 2, `<< /Length ${content.length} >>`, content);
  });

  const count = 4 + pages.length * 3;
  const xref = length;
  text(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++)
    text(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  text(
    `trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );

  // A fresh ArrayBuffer-backed copy: Blob's types do not accept the wider
  // ArrayBufferLike a Uint8Array may carry.
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

/**
 * One receipt on a page of its own size. `widthPx`/`heightPx` are the capture at
 * 2x scale: 2 image pixels per CSS pixel, 0.75pt per CSS px.
 */
export function jpegToPdf(
  jpeg: Uint8Array,
  widthPx: number,
  heightPx: number,
  title: string,
): Blob {
  return imagesToPdf(
    [
      {
        jpeg,
        widthPx,
        heightPx,
        pageW: widthPx * 0.375,
        pageH: heightPx * 0.375,
      },
    ],
    title,
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
