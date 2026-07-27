// CRL Bridge poller — claims jobs and degrades to fail→L0 when Playwright is absent.

const base = process.env.GLAZEBOARD_URL || "http://localhost:3000";
const secret = process.env.BRIDGE_SHARED_SECRET || "";
const companyId = process.env.DEFAULT_COMPANY_ID || "";

async function claim() {
  const res = await fetch(`${base}/api/bridge/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-secret": secret,
    },
    body: JSON.stringify({ company_id: companyId }),
  });
  if (!res.ok) throw new Error(`claim ${res.status}`);
  return res.json();
}

async function patch(id, body) {
  await fetch(`${base}/api/bridge/jobs/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-secret": secret,
    },
    body: JSON.stringify({ company_id: companyId, ...body }),
  });
}

async function runJob(job) {
  // Without Playwright installed, fail closed to L0 (product requirement).
  console.log("Claimed job", job.id, "level", job.level);
  try {
    // Placeholder: a real deploy installs playwright and drives CRL Showers Online here.
    await patch(job.id, {
      action: "fail",
      error: "Playwright not installed in this environment — use L0 Send to CRL panel.",
    });
  } catch (e) {
    await patch(job.id, { action: "fail", error: String(e) });
  }
}

async function loop() {
  if (!secret) {
    console.error("BRIDGE_SHARED_SECRET required");
    process.exit(1);
  }
  for (;;) {
    try {
      const { job } = await claim();
      if (job) await runJob(job);
    } catch (e) {
      console.error(e);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

loop();
