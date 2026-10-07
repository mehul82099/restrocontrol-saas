export function apiFetch(outletId: string, input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (outletId) headers.set('x-outlet-id', outletId);
  return fetch(input, {...init, headers});
}
