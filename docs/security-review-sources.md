# Source ledger
- Next November3 official release: https://nextjs.org/blog/november-2026-security-release . Patch15.5.29 and16.4.5.
- Next advisories index: https://github.com/vercel/next.js/security/advisories
- React advisory index: https://github.com/facebook/react/security/advisories
- Cloudflare server token validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ . Requires secret key; single-use5minute tokens and hostname/action validation.
- Next Edge cookie advisory: https://github.com/vercel/next.js/security/advisories/GHSA-f3mh-rxg3-f5g2 . Current code uses Node routes, not Edge cookie routes.
- Next forwarding-response advisory: https://github.com/vercel/next.js/security/advisories/GHSA-pc58-hwjq-p385 . Current code uses constructed responses rather than forwarding fetched Response unchanged; not claiming exploitability.
- React October RSC advisory: https://github.com/facebook/react/security/advisories/GHSA-xqc2-xf4c-x3h3 . Installed top-levelReact18.3.1; framework vendoredRSC needs framework patching, not blanketReact18vulnerable claim.
- Current source maina5ff387 via authenticatedGitHub/livegitfetch.
- Live passive GET/HEAD https://restrocontrol.new.tg/ and /robots.txt and unauthenticated /api/pos/catalog,/api/live/orders . HSTSmissing, otherbaselineheaderspresent, API401private-no-store.
