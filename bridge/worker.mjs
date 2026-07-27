// CRL Bridge poller — Playwright when BRIDGE_PLAYWRIGHT=1; else fail→L0.

const base = process.env.GLAZEBOARD_URL || "http://localhost:3000";
const secret = process.env.BRIDGE_SHARED_SECRET || "";
const companyId = process.env.DEFAULT_COMPANY_ID || "";
const usePlaywright = process.env.BRIDGE_PLAYWRIGHT === "1";

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

async function runWithPlaywright(job) {
  // Dynamic import keeps Playwright out of the main app bundle.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const m = job.payload?.measurements || {};
    // Navigate placeholder — real CRL URLs require D4 clearance and stable selectors.
    await page.goto("about:blank");
    await page.setContent(
      `<html><body><h1>CRL Bridge L${job.level}</h1>
       <pre>${JSON.stringify({ title: job.payload?.title, m }, null, 2)}</pre>
       </body></html>`,
    );
    const shot = await page.screenshot({ type: "png" });
    // In production upload shot to R2 via a dedicated bridge upload route; checkpoint key only here.
    const key = `bridge/${job.id}/checkpoint-1.png`;
    await patch(job.id, { action: "checkpoint", screenshot_key: key });
    if (job.level >= 2) {
      // L2: stop before checkout — mark done after cart-prep simulation
      await patch(job.id, { action: "done" });
    }
    console.log("checkpointed", job.id, "bytes", shot.length);
  } finally {
    await browser.close();
  }
}

async function runJob(job) {
  console.log("Claimed job", job.id, "level", job.level);
  if (!usePlaywright) {
    await patch(job.id, {
      action: "fail",
      error: "Playwright not enabled (BRIDGE_PLAYWRIGHT≠1) — use L0 Send to CRL panel.",
    });
    return;
  }
  try {
    await runWithPlaywright(job);
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
