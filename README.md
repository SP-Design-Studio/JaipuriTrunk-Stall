# JaipuriTrunk-Stall

The till and receipt maker for the JaipuriTrunk stall. Built for an iPad, in
Hyderabad. A separate app from the website; it shares no code with it.

- Ring up a sale, take cash or UPI, apply a discount. Items can carry a size and
  a colour, chosen when tapped.
- Make a branded receipt and send it as an image (PNG) or a PDF attachment, or
  save either to Files.
- Sales shows takings, a bill log, **what sold** (each item by size, colour and
  price), and two CSV downloads: one row per bill, one row per item.
- The **Items** tab adds, renames and removes categories and items, and sets
  prices, sizes and colours.
- One login, set in the environment.

**Nothing is stored on the iPad.** Sales, the item list and customers' phone
numbers live in the database; the browser holds only what is on screen. The
cost is that the till needs a connection to record a sale, and says so plainly
instead of pretending. A sale that fails to save is held on screen, locked, and
retried; it is never shown a receipt until the database has confirmed it.

## Set up

1. `cp .env.example .env.local` and fill it in (the file explains each value).
2. Run the files in `supabase/migrations/` in the Supabase SQL editor, lowest
   number first (see `supabase/migrations/README.md`).
3. `npm install && npm run dev`, then open http://localhost:3000.

With no Supabase keys, `npm run dev` stores everything in `.stall-dev-data.json`
on your Mac so you can try the till straight away. That file is a stand-in, not
the real database, and is only used outside production: a deployed till with no
database shows a setup message and won't open.

## Before the first real day

- Open the **Items** tab and set your prices, add what you stock and remove what
  you don't. Categories can have their own sizes (juttis ask for one when
  tapped). The list is saved to the database as you type.
- `src/lib/config.ts`: the stall's address, phone and GSTIN (if any). Anything
  left empty is simply left off the receipt.

## On the iPad

Open it in Safari, sign in, then Share, then Add to Home Screen. It opens as a
full-screen app with no browser bars. It keeps its own login, so you sign in
once more there.

## Limits worth knowing

- Invoice numbers are date and time (`JT-24102026-203015-0007`: ddmmyyyy, hhmmss, then a running count 0001, 0002… given out by the server).
  If you register for GST you will need consecutive numbers.
- No tax is calculated on receipts.
- Whole rupees only.
- PDFs are the receipt picture on a page: they look the same everywhere, but the
  text isn't selectable.
- WhatsApp *links* can't carry a file. To send the PNG or PDF, use the share
  buttons and choose WhatsApp; "Open their WhatsApp chat" sends text only.
- Rate-limit `/api/login` (do this once, after the first deploy). The built-in
  delay slows guessing but serverless instances share no memory, so it cannot
  count attempts. In Vercel: project → Firewall → Configure → Add rule.
  Name it "Login limit"; condition Request Path equals `/api/login` (and method
  POST); action Rate Limit, fixed window, 5 requests per 60 seconds, keyed by
  IP address; when exceeded, Deny (or Challenge). Then Review changes → Publish.

## Customer receipt links and verifying a receipt

- Each sale gets a private link, `/r/<sale id>.<signature>`, signed with
  `RECEIPT_SECRET`. The WhatsApp message carries it; the customer opens their
  receipt and can download the image or PDF. It reads the sale from the
  database, so it keeps working for as long as the sale is stored.
- The public page shows the bill only. The customer's name and phone number are
  removed on the server and never sent to that page. It is `noindex`, and a
  wrong or edited link is a plain 404.
- Set `RECEIPT_SECRET` once and never change it: changing it breaks every link
  already sent. Keep it different from `POS_SESSION_SECRET`.
- Every receipt carries a verify code (e.g. `8PXN-X8GG`) tied to the bill
  number, amount and time. In Sales → Verify receipt, staff enter the number
  and code to see the stored record and compare it with what they were shown.

### Keeping records (India)

This is a note for the owner, not legal advice; confirm with your CA.
- GST law asks registered businesses to keep invoices and accounts for a period
  (generally 72 months from the due date of the annual return for the year).
  Keeping the sale rows that long is expected; "forever" is not required.
- The Digital Personal Data Protection Act, 2023 expects personal data (name,
  phone) to be kept only as long as it is needed, and removed when a customer
  withdraws consent. That is why the public page carries no name or phone, and
  why the phone is only ever used for messaging if they ticked the box.
- Practical plan: keep bills for the tax period, and delete or blank a
  customer's name/phone when they ask or when the period ends.

## UPI QR and printing all bills

- Settings tab → UPI QR: staff upload a screenshot or photo of the QR. It is shrunk
  on the iPad, stored in the database (the `stall_catalog` table, no new table),
  and shown full-screen from the till's "Show UPI QR" button when UPI is chosen.
- Sales tab → Print / PDF: every bill in the current list (Today or All sales,
  latest 100) as an A4 PDF and as PNG pages, one bill per page, oldest
  first, for book-keeping or printing. Made on the iPad and kept nowhere.
- Settings tab → WhatsApp messages: the wording of the after-sale message and
  the follow-up, with tags like `{name}`, `{total}`, `{bill}`, `{link}`. Saved
  in the database; "Use standard wording" puts the original back.
- Items tab: each item has a photo box. Pictures are shrunk on the iPad to the
  register tile (360 px square), stored in the database and served by
  `/api/item-image/<id>`; removing the item removes its photo.
- Colours are the logo's: maroon `#762136` (RGB 118, 33, 54), orange `#f49b49`.
  Logos in `public/images`: `monogram-orange.png` + `wordmark-orange.png` (dark header), `monogram-black.png` + `wordmark-black.png` (receipt, prints well in black and white), `logo-orange.png` (full monogram + name, transparent) and `logo.png` (the same on maroon; also the app icon in `src/app`).
- A customer name is required on every bill.
- WhatsApp opens through `whatsapp://` (straight into the app, no web page); a
  small "use the web link" fallback sits under it.
- Settings → Start again: deletes every bill and takes the bill number back to
  0001 (the number is "one more than the latest bill", so there is nothing
  else to reset). Offers a backup CSV first; needs the word DELETE and the login
  password. Bills are tax records: use it for clearing test sales only.
- Settings → Backup & restore: "Download backup" saves every bill as a `.json`
  file that can be put back with "Restore from backup…" (keeps bill numbers,
  skips bills already there, recomputes totals, so a doctored file can't change
  an amount). The Bills/Items CSVs on the Sales tab are reports and can't be
  imported. "Delete all bills" offers this backup first.
- Settings → Stalls: a "stall" is each time the market happens (e.g. "November
  2026 — Lamakaan"). Start a new one each month; exactly one is current, and
  every bill is recorded against it automatically (no picking at the till). Its
  name, address and phone are printed on the receipt and saved with the bill.
  Past stalls stay in the list. Pick its days on the in-app calendar (tap one day, or a first and a last day). In Sales, "This stall" shows the current one, the
  stall dropdown shows any past one, "By day" gives a per-day UPI/cash/discount/
  total table for the books, and the CSVs, PDF and backup carry the stall.
  **Run migration `0003_add_stall_to_sales.sql` first**: it adds the `stall` column.
- Stock: on the Items tab type a stock number next to an item (empty = not
  counted). The register tile shows "N left" / "Only N left" / "Sold out" and
  won't let more than the stock onto a bill; saving a bill lowers the count on
  the server, once per bill (a retried upload doesn't count twice) and never below
  zero. Sales → Stock lists counted items, lowest first, with what sold in the
  current list. Counts are per item, not per size or colour. Stock is kept in its
  own table: **run migration `0004_add_stock.sql` first**. Until it is run, selling
  still works; stock just isn't shown or counted.
- Receipts have torn, printer-feed edges top and bottom (a row of small teeth drawn
  as an SVG strip in `Receipt.tsx`; `TOOTH` / `TOOTH_H` set their size). The capture
  keeps the corners transparent and lays the PNG, PDF and print pages on white.
- Reviews: when a customer opens their bill link they are first asked for a review
  (1 to 5 stars, an optional comment, and a tick box for "OK to show this publicly
  with my first name"), with a Skip button that is remembered on their own phone
  for 3 days. The same review has its own link (`<receipt link>/review`) for a
  later WhatsApp nudge: the **Ask for a review on WhatsApp** button on a bill, and a
  `{review}` tag in Settings → WhatsApp messages (there is a new "Ask for a review"
  message). The signed link ties a review to one real bill, one review per bill,
  with no login. Staff read them in Sales → Reviews. Reviews are never shown
  publicly by the app; the consent tick is stored for when you want that. **Run
  migration `0005_add_reviews.sql` first.** Until it is run, the bill opens as
  before and simply doesn't ask. Add a Vercel firewall rate limit on `/api/review`
  (like the login one): 10 requests per minute per IP is plenty.
- Review tracking: the server notes when a bill's review prompt was shown, when the
  customer tapped Skip, and when staff sent the review link on WhatsApp. A
  review always wins, so someone who skipped and later wrote one counts as
  reviewed; the later link just works, as the review is tied to the bill, not to
  the first prompt. Sales shows a ★ / "Skipped review" / "Review link sent" tag on
  each bill, and Sales → Reviews has "X of Y bills reviewed" plus a **Not
  reviewed** list (who skipped, who was nudged, who was never asked) with an
  **Ask on WhatsApp** button. **Run migration `0006_review_status.sql` first**;
  until then reviews still work but Sales can't say who skipped or was asked.
