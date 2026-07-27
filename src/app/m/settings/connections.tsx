"use client";

// Connection rows — mailbox, QuickBooks, CRL Bridge flags.

export function ConnectionsPanel({
  mail,
  qb,
  crlEnabled,
  crlTos,
  isAdmin,
}: {
  mail: { purpose: string; email: string; connected_at: string | null }[];
  qb: { product: string; connected_at: string | null; realm_id: string | null } | null;
  crlEnabled: boolean;
  crlTos: boolean;
  isAdmin: boolean;
}) {
  const office = mail.find((m) => m.purpose === "office");
  const service = mail.find((m) => m.purpose === "service");

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase text-stone-500">Connections</h2>
      <Row
        label="Office mailbox"
        status={office?.connected_at ? `Connected · ${office.email}` : "Not connected"}
        href={isAdmin ? "/api/integrations/gmail/start?purpose=office" : undefined}
        action={isAdmin ? "Connect" : undefined}
      />
      <Row
        label="Service mailbox"
        status={service?.connected_at ? `Connected · ${service.email}` : "Not connected"}
        href={isAdmin ? "/api/integrations/gmail/start?purpose=service" : undefined}
        action={isAdmin ? "Connect" : undefined}
      />
      <Row
        label="QuickBooks"
        status={
          qb?.connected_at
            ? `Connected · ${qb.product}${qb.realm_id ? ` · ${qb.realm_id}` : ""}`
            : "Not connected"
        }
        href={isAdmin ? "/api/integrations/qb/start" : undefined}
        action={isAdmin ? "Connect" : undefined}
      />
      <Row
        label="CRL Bridge"
        status={
          crlTos && crlEnabled
            ? "L1 enabled"
            : crlTos
              ? "ToS accepted · flag off"
              : "Off until ToS (D4)"
        }
      />
      <p className="text-xs text-stone-500">
        Twilio / WhatsApp use env secrets on the Worker. Telegram bind is below.
      </p>
    </section>
  );
}

function Row({
  label,
  status,
  href,
  action,
}: {
  label: string;
  status: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded border px-3 py-2 text-sm">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-stone-500 text-xs">{status}</div>
      </div>
      {href && action ? (
        <a href={href} className="rounded border px-2 py-1 text-xs hover:bg-stone-50">
          {action}
        </a>
      ) : (
        <span
          className={`text-xs rounded px-2 py-0.5 ${
            status.startsWith("Connected") || status.includes("enabled")
              ? "bg-stone-900 text-white"
              : "bg-stone-100 text-stone-600"
          }`}
        >
          {status.startsWith("Connected") || status.includes("enabled") ? "On" : "Off"}
        </span>
      )}
    </div>
  );
}
