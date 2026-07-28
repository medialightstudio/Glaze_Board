// POST {to, reason?, note?, method?} — status change via status-machine only.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { recordApproval, transition, type Status } from "@/lib/status-machine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, any>;
  const to = String(body.to || "") as Status;
  if (!to) return NextResponse.json({ error: "Missing target status." }, { status: 400 });

  try {
    const result = await withUser(session, async (c) => {
      const actor = { kind: "user", userId: session.userId };
      if (to === "approved") {
        return recordApproval(c, session, id, actor, {
          method: body.method,
          note: body.note,
        });
      }
      return transition(c, session, id, to, actor, {
        reason: body.reason,
        note: body.note,
      });
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transition failed." },
      { status: 400 },
    );
  }
}
