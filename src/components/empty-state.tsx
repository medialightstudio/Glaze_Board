// Titled empty state for screens that arrive in a later phase.

export function EmptyState({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-2">{title}</h1>
      <p className="text-stone-600">Nothing here yet — arrives in Phase {phase}.</p>
    </div>
  );
}
