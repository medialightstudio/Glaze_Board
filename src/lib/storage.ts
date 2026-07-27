// Only touchpoint for R2 document bytes — API routes check documents table first.

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type DocsBucket = {
  put: (key: string, value: ArrayBuffer | Uint8Array | string, opts?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get: (key: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  delete: (key: string) => Promise<unknown>;
};

export async function getDocsBucket(): Promise<DocsBucket> {
  const { env } = await getCloudflareContext({ async: true });
  const bucket = (env as { DOCS?: DocsBucket }).DOCS;
  if (!bucket) {
    throw new Error("R2 docs bucket binding missing. Add DOCS in wrangler.jsonc.");
  }
  return bucket;
}

export function objectKey(companyId: string, documentId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${companyId}/${documentId}/${safe}`;
}
