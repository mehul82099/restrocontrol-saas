'use client';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type Turnstile = {render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void};
export default function HumanCheck({siteKey, action, reset, onToken}: {siteKey: string; action: 'login' | 'register'; reset: number; onToken: (value: string) => void}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken); callback.current = onToken;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const api = (window as unknown as {turnstile?: Turnstile}).turnstile;
    callback.current('');
    if (!ready || !siteKey || !api || !container.current) return;
    setError('');
    let id: string;
    try {
      id = api.render(container.current, {sitekey: siteKey, action, size: 'flexible', theme: 'light',
        callback: (token: string) => {setError(''); callback.current(token);},
        'expired-callback': () => {callback.current(''); setError('Verification expired. Please complete the check again.');},
        'error-callback': () => {callback.current(''); setError('Human check could not load. Please reload and try again, or use Google sign-in.');},
      });
    } catch { setError('Human check could not load. Please reload and try again.'); }
    return () => {if (id) api.remove(id);};
  }, [ready, siteKey, action, reset]);
  return <div className="min-w-0 space-y-2" aria-label="Human verification">
    <Script id="cloudflare-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setError('Human check could not load. Please reload and try again.')} />
    <div ref={container} className="min-h-[65px] w-full" />
    {!siteKey && <p role="alert" className="text-xs text-rose-700">Human verification is temporarily unavailable. Please try again shortly.</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
  </div>;
}
