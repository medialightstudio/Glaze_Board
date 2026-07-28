// Generate a branded customer-facing quote PDF into bytes (pdf-lib).

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@/lib/money";

export type QuotePdfInput = {
  companyName: string;
  customerName: string;
  homeownerName?: string | null;
  siteAddress?: string | null;
  terms?: string | null;
  lines: { description: string; qty: number; unit_cents: number }[];
  totalCents: number;
};

export async function buildQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 750;

  page.drawText(input.companyName || "Glaze Board", {
    x: 48,
    y,
    size: 20,
    font: bold,
    color: rgb(0.12, 0.12, 0.12),
  });
  y -= 28;
  page.drawText("Quote", { x: 48, y, size: 14, font: bold });
  y -= 24;
  page.drawText(`Customer: ${input.customerName}`, { x: 48, y, size: 11, font });
  y -= 16;
  if (input.homeownerName) {
    page.drawText(`Homeowner: ${input.homeownerName}`, { x: 48, y, size: 11, font });
    y -= 16;
  }
  if (input.siteAddress) {
    page.drawText(`Site: ${input.siteAddress}`, { x: 48, y, size: 11, font });
    y -= 24;
  } else {
    y -= 8;
  }

  page.drawText("Description", { x: 48, y, size: 10, font: bold });
  page.drawText("Qty", { x: 360, y, size: 10, font: bold });
  page.drawText("Amount", { x: 420, y, size: 10, font: bold });
  y -= 14;
  page.drawLine({
    start: { x: 48, y },
    end: { x: 564, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 16;

  for (const line of input.lines) {
    const amount = Math.round(line.qty * line.unit_cents);
    page.drawText(line.description.slice(0, 48), { x: 48, y, size: 10, font });
    page.drawText(String(line.qty), { x: 360, y, size: 10, font });
    page.drawText(formatCents(amount), { x: 420, y, size: 10, font });
    y -= 16;
    if (y < 120) break;
  }

  y -= 8;
  page.drawText(`Total: ${formatCents(input.totalCents)}`, {
    x: 420,
    y,
    size: 12,
    font: bold,
  });
  y -= 28;
  if (input.terms) {
    page.drawText("Terms", { x: 48, y, size: 11, font: bold });
    y -= 14;
    const terms = input.terms.slice(0, 500);
    page.drawText(terms, { x: 48, y, size: 9, font, maxWidth: 500, lineHeight: 12 });
  }

  return doc.save();
}
