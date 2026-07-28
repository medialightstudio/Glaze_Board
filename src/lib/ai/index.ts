// Single LLM door — every call logged by the caller into ai_runs.

import { z } from "zod";

const extractSchema = z.object({
  doc_type: z.string(),
  supplier: z.string().optional().default(""),
  order_number: z.string().optional().default(""),
  our_po_number: z.string().optional().default(""),
  line_items: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().optional(),
        amount_cents: z.number().optional(),
      }),
    )
    .optional()
    .default([]),
  promised_date: z.string().optional().default(""),
  ship_date: z.string().optional().default(""),
  total: z.number().optional().default(0),
  confidence: z.number().optional().default(0),
  quote_number: z.string().optional().default(""),
  hardware_bom: z
    .array(z.object({ description: z.string(), qty: z.number().optional() }))
    .optional()
    .default([]),
});

export type ExtractResult = z.infer<typeof extractSchema>;

const intentSchema = z.object({
  intent: z.string(),
  entities: z.record(z.string(), z.unknown()).optional().default({}),
  confidence: z.number().optional().default(0),
});

export type IntentResult = z.infer<typeof intentSchema>;

function apiBase() {
  return process.env.LLM_API_BASE || "https://api.openai.com/v1";
}

function apiKey() {
  return process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
}

export async function chatJson<T>(
  system: string,
  user: string,
  schemaHint: string,
): Promise<{ raw: unknown; model: string } | null> {
  const key = apiKey();
  if (!key) return null;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const res = await fetch(`${apiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${system}\nReturn JSON only matching: ${schemaHint}` },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content || "{}";
  try {
    return { raw: JSON.parse(content), model };
  } catch {
    return { raw: {}, model };
  }
}

export async function extractDocument(text: string): Promise<ExtractResult | null> {
  const result = await chatJson(
    "You extract supplier and quote document fields for a glass shop.",
    text.slice(0, 12000),
    "{doc_type,supplier,order_number,our_po_number,line_items,promised_date,ship_date,total,confidence,quote_number,hardware_bom}",
  );
  if (!result) {
    // Heuristic fallback when no LLM key
    const po = text.match(/PO[#:\s-]*([A-Z0-9-]+)/i)?.[1] || "";
    return extractSchema.parse({
      doc_type: /ack|acknowledg/i.test(text) ? "acknowledgment" : "other",
      our_po_number: po,
      confidence: po ? 0.5 : 0.2,
      total: 0,
    });
  }
  return extractSchema.parse(result.raw);
}

export async function parseIntent(text: string): Promise<IntentResult | null> {
  const result = await chatJson(
    "You parse shop commands into intents.",
    text,
    "{intent,entities,confidence}",
  );
  if (!result) {
    const lower = text.toLowerCase();
    if (lower.includes("ticket") || lower.includes("service")) {
      return { intent: "create_ticket", entities: { note: text }, confidence: 0.4 };
    }
    if (lower.includes("project") || lower.includes("new job")) {
      return { intent: "create_project", entities: { note: text }, confidence: 0.4 };
    }
    return { intent: "query", entities: { note: text }, confidence: 0.3 };
  }
  return intentSchema.parse(result.raw);
}
