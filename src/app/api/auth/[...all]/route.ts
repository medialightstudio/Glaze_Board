// Better Auth HTTP handler — auth/Pool created per request via getAuth().

import { getAuth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

function handlers() {
  return toNextJsHandler(getAuth());
}

export const GET = (req: Request) => handlers().GET(req);
export const POST = (req: Request) => handlers().POST(req);
