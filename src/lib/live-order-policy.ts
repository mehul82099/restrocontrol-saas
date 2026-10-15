// Free-tier safety net, not an instant-delivery promise. Push wakes pages sooner.
export const FALLBACK_MS = 120000;
export const PUSH_FALLBACK_MS = 300000;
export const MIN_WAKE_MS = 15000;
export function liveCheckDelay(pushEnabled: boolean, failures = 0): number {
  return Math.min(900000, (pushEnabled ? PUSH_FALLBACK_MS : FALLBACK_MS) * 2 ** Math.min(failures, 3));
}
export function shouldCheckLive(visible: boolean, online: boolean): boolean {
  return visible && online;
}
