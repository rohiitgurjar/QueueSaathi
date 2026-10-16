// Queue sessions roll over at 00:00 UTC. Keep this policy explicit and consistent.
export function currentSessionKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
