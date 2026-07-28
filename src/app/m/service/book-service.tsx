"use client";

import { BookVisitSheet } from "@/components/ops/book-visit-sheet";

export function BookServiceVisit({
  ticketId,
  projectId,
  users,
}: {
  ticketId: string;
  projectId?: string;
  users: { id: string; name: string }[];
}) {
  return (
    <BookVisitSheet
      users={users}
      ticketId={ticketId}
      projectId={projectId}
      defaultType="service"
      triggerLabel="Book service visit"
    />
  );
}
