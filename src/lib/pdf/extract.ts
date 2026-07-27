// Text-layer PDF extraction — OCR/LLM fallbacks live in ai/.

export async function extractPdfText(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Lightweight Latin text scrape from PDF streams (no native OCR).
  const asString = Buffer.from(buf).toString("latin1");
  const chunks: string[] = [];
  const re = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(asString))) {
    chunks.push(m[1].replace(/\\([nrt\\()])/g, (_, c) => {
      if (c === "n") return "\n";
      if (c === "r") return "\r";
      if (c === "t") return "\t";
      return c;
    }));
  }
  const joined = chunks.join(" ").replace(/\s+/g, " ").trim();
  if (joined.length > 40) return joined;
  // Fallback: strip binary and keep printable runs
  return asString
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}
