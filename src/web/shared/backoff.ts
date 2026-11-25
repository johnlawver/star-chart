/** How long to wait before try number `attempt` (0 for the first retry): about 1 s, doubling each time, up to 30 s. */
export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}
