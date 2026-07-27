/* Push-only service worker — no offline caching (DEC / ledger G2). */

self.addEventListener("push", (event) => {
  let data = { title: "Glaze Board", body: "", url: "/m" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Glaze Board", {
      body: data.body || "",
      data: { url: data.url || "/m" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/m";
  event.waitUntil(clients.openWindow(url));
});
