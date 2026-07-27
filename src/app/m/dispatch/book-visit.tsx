// Dispatch book-visit entry — shared sheet.

"use client";

import { BookVisitSheet } from "@/components/ops/book-visit-sheet";

export function BookVisitForm({
  users,
  projects,
}: {
  users: { id: string; name: string }[];
  projects: { id: string; title: string }[];
}) {
  return <BookVisitSheet users={users} projects={projects} />;
}
