# Traffic and usage protection

## Activate before deploying

1. Run `server/site-usage.sql` in your Supabase SQL Editor, after the existing `server/gallery-schema.sql`. It adds private counters, editable policies, and the paginated gallery function. Existing builds are preserved. Rerunning it preserves counters and policy edits.
2. Keep `GALLERY_SUPABASE_URL` and `GALLERY_SUPABASE_SERVICE_KEY` in Vercel, server-only. No new account or secret is required. These settings now protect both gallery and statistics APIs.
3. Push this code and deploy. Missing shared-counter configuration or RPC functions deliberately returns 503; production never falls back to per-instance memory limits. The static home page and browser-based idea generator continue working if the APIs are unavailable.
4. Open `/api/gallery`: expect at most 24 projects and `hasMore`. A normal response has a 30-second CDN cache lifetime. A publication refresh uses the fixed `fresh=1` query to show the new entry immediately and still consumes the shared read quota.

## Default limits

| Operation | Per client IP/network | Whole site |
| --- | --- | --- |
| Gallery API reads reaching the function | 60/minute | 1,200/minute |
| Submission requests before validation | 10/minute | 120/minute |
| Valid publication attempts | 3/hour and 10/day | 100/day |
| Statistics API reads reaching the function | 60/minute | 1,200/minute |
| Google Analytics report fetches | — | 12/minute and 500/day |

Limits use fixed UTC-aligned windows, so a burst can occur on both sides of a window boundary. Publication attempts include duplicate retries and later storage failures; rejected attempts do not consume additional quota. Existing hidden builds cannot be republished by retrying their IDs. Limits apply to an IP/network, not a person: people sharing Wi-Fi share a quota. IPv6 addresses are grouped by /64. Vercel's overwritten `X-Forwarded-For` is trusted only on Vercel; other servers use the direct socket address. Raw IPs are not stored. Client identities are HMAC hashes using the existing server secret.

Each decision and increment is atomic in PostgreSQL and shared across deployments using that database. Expired counter rows are removed in bounded batches during requests. Limits return HTTP 429, `Retry-After`, and a user-facing message. Limiter outages return 503, never an unprotected successful write. A short database lock timeout bounds lock contention. In local development without Supabase, bounded memory counters are used only for development; use Supabase even for a production server with local project files.

Edit `max_requests` in Supabase's private `site_usage_policies` table to change production limits. For example, to allow 200 publication attempts per day across the site:

```sql
update public.site_usage_policies
set max_requests = 200
where policy = 'gallery-publish' and scope = 'global' and window_seconds = 86400;
```

## Work avoided and bounded

- Spins and idea generation run entirely in the visitor's browser. A spin never calls the gallery database or statistics API. Existing spin animation already ignores clicks while spinning.
- Statistics refresh at most every five minutes, preserve the displayed totals on errors, and honor API retry timing. Google reports retain their existing five-minute server/CDN cache and in-flight request sharing.
- Embedded copies skip analytics collection and statistics requests. Demo frames mount only while visible, unload off-screen or when the tab is hidden, and cannot recursively embed more galleries.
- Gallery pages contain 24 projects, with one extra row used to detect the next page. Search and filters run on the server and apply beyond the current page. Page numbers stop at 1,000 (24,024 accessible entries); raise the cap or migrate to cursor pagination before reaching that collection size.
- Search text is capped at 80 characters and debounced for 350 milliseconds. Requests with unknown or repeated query parameters are rejected.
- Submissions are capped at 32 KB of UTF-8 JSON, with the existing individual field limits. Large declared bodies are rejected before quota/database work. Uploaded image data is no longer accepted into stored projects, and old screenshot data is excluded from production gallery reads.

## Vercel edge protection

The code limits work after a function is invoked. It cannot cap static-page bandwidth, stop invocation charges before execution, or replace DDoS protection. Configure these additional **IP-based fixed-window rate limits** in Vercel → project → Firewall → Configure:

| Match | Limit | Action |
| --- | --- | --- |
| Path `/api/gallery`, method `POST` | 10 requests / 60 seconds / IP | Rate limit |
| Path `/api/gallery`, method `GET` | 60 requests / 60 seconds / IP | Rate limit |
| Path `/api/stats`, methods `GET` or `HEAD` | 60 requests / 60 seconds / IP | Rate limit |

Review and publish the firewall rules. Dashboard availability and settings depend on your Vercel plan. These dashboard rules are separate from the code and are **not created by deploying this repository**. Keep Vercel's automatic DDoS mitigation enabled. Review your project's usage and spend controls as traffic grows; these application quotas do not guarantee a hosting bill cap or uninterrupted service during an attack.

References: [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [trusted Vercel request headers](https://vercel.com/docs/headers/request-headers), [Vercel CDN caching](https://vercel.com/docs/caching/cdn-cache).

## Verification

`npm test` includes PostgreSQL-backed migration tests through PGlite (development only), concurrency/expiry/quota checks, anonymous-access checks, API 429 and UTF-8 payload checks, bounded pagination, analytics budget checks, and browser refresh cooldown tests. These checks verify behavior, not the capacity of your live Vercel/Supabase plans. No production load test or live quota consumption is performed.
