// Free-tier safety net, not an instant-delivery promise. Push wakes pages sooner.
export const FALLBACK_MS = 120000;
export const PUSH_FALLBACK_MS = 300000;
export const MIN_WAKE_MS = 15000;
// When nothing changes for a while, the check stretches stepwise up to a cap so
// quiet periods (closed hours, idle screens) spend far fewer database operations.
// Any revision change, tab focus, visibility return or screen touch resets it.
export const IDLE_STEP_LIMIT = 3;
export const IDLE_MAX_MS = 300000;
export const IDLE_PUSH_MAX_MS = 600000;
export function liveCheckDelay(pushEnabled: boolean, failures = 0): number {
  return Math.min(900000, (pushEnabled ? PUSH_FALLBACK_MS : FALLBACK_MS) * 2 ** Math.min(failures, 3));
}
export function liveIdleDelay(pushEnabled: boolean, idlePolls: number): number {
  const base = pushEnabled ? PUSH_FALLBACK_MS : FALLBACK_MS;
  const cap = pushEnabled ? IDLE_PUSH_MAX_MS : IDLE_MAX_MS;
  return Math.min(cap, base * 2 ** Math.min(Math.max(idlePolls, 0), IDLE_STEP_LIMIT));
}
export function shouldCheckLive(visible: boolean, online: boolean): boolean {
  return visible && online;
}
