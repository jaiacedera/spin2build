# spin2build

A minimalist project idea generator built with Vue 3, TypeScript, and Vite. Pair 15 project types with 121 topics, then generate a detailed starting point locally.

Run `npm install` and `npm run dev` to start. `npm run build` checks TypeScript and produces the production site in `dist`; `npm run preview` serves that build.

Use **spin now**, **Generate Again**, or the header arrow to spin both selectors. Each selector also supports previous/next buttons, ArrowUp/ArrowDown when focused, mouse wheel, and vertical touch swipes. Reduced-motion preferences skip the long animation.

**Copy Idea** copies the short project sentence (requires localhost or HTTPS and clipboard permission). **Generate Idea** selects a local template with no API calls. The public community gallery is available at `/#gallery`.

### Public community gallery

The Supabase JavaScript client is configured in `src/utils/supabase.ts` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `.env.local` supplies these locally and is git-ignored; add the same settings in Vercel for builds that use this client. Session persistence, automatic token refresh, and authentication callback detection are disabled. My Builds continues to use browser-only localStorage.

This browser client does not replace the community `/api/gallery` endpoint. The existing gallery schema deliberately gives anonymous clients no direct table access, so the publishable key alone does not enable community storage. Configure the server settings below to enable the shared gallery. The tutorial's `todos` UI is not part of Spin2Build.

The Gallery has two top-level views: **Community** (`/#gallery`) and **My Builds** (`/#gallery/my-builds/drafts`). My Builds is local to the current browser and needs no backend or account. Accepting a generated challenge saves it as a draft and offers **Keep Spinning** or **View Draft**. Use **Start Building** to move it to In Progress, then **Mark Complete** to move it to Completed. Checklists stay with the build across reloads. Completed builds can prefill the public submission form, but are never published automatically.

Previous local challenges are preserved under the existing `spin2build.build-history.v1` localStorage key. Older records without a status are read as Drafts when untouched, In Progress when partly checked, or Completed when every feature is checked. Explicit statuses are retained; accepting the same direction again does not reset its progress. The old history popup has been removed.

Anyone can browse and submit, without a visitor account. The four-step submission flow collects the project source and details, uploads a PNG/JPEG/WebP screenshot (up to 1 MB), previews the same card/detail components used publicly, and submits for review. Screenshots are stored as image data URLs with the project, so a separate upload service is not required.

`POST /api/gallery` validates fields and image signatures, assigns `pending`, clears `featured`, and sets the creation time on the server. Submissions cannot approve themselves. Retrying the same submission ID does not create a duplicate or overwrite a reviewed build. `GET /api/gallery` returns approved projects only, newest first. Community has search and All, From Spin2Build, Original Ideas, Featured, and Newest filters. My Builds has Drafts, In Progress, and Completed tabs. Local build status is independent of community moderation `status`.

During `npm run dev`, submissions persist as individual JSON files under `.gallery-data.local` (git-ignored and blocked from Vite's file server). No example builds are represented as community submissions. Privately change a file's `status` to `approved` or `rejected` to review a local build; set `featured` to `true` to feature it. Refresh the gallery after moderation. There is no public administration or update endpoint.

For a shared production gallery:

1. Run [server/gallery-schema.sql](server/gallery-schema.sql) in your Supabase SQL editor.
2. Set server-only `GALLERY_SUPABASE_URL` and `GALLERY_SUPABASE_SERVICE_KEY` (the legacy `service_role` key) in your host environment. No Supabase Auth configuration or visitor accounts are needed. The table has row-level security enabled and no anonymous table grants; only the server accesses it through the [Supabase REST API](https://supabase.com/docs/guides/api).
3. Deploy the Node endpoint in `api/gallery.ts` together with the site, as with the existing stats endpoint. A static `dist` upload alone cannot accept submissions. In serverless production, missing database configuration returns an unavailable response rather than pretending to save to temporary storage.
4. Moderate privately in the database by changing the row's top-level `status` to `approved` or `rejected`. Example queries are in the schema file. `project.featured` controls the Featured filter. Neither pending nor rejected records are returned publicly.

A single persistent Node server can instead set `GALLERY_LOCAL_DIR` to a durable directory. This file adapter is intended for one server; use the shared database for multiple instances. Local data is not automatically migrated to the production database. For local production preview, set `GALLERY_LOCAL_DIR=.gallery-data.local` or configure the database before starting `npm run preview`.

Edit `src/data/projectTypes.ts`, `src/data/topics.ts`, and `src/data/ideas.ts` to customize the choices and templates. Animation logic lives in `src/composables/useSpinner.ts`; the shared selector is `src/components/TextSpinner.vue`.

Google Analytics uses measurement ID `G-Z408WTQHSV`. Tracking runs in production builds (including `npm run preview`), and is disabled during `npm run dev`. The Google tag collects page views and sessions; `spin_generated` is sent once after both selectors finish, with `project_type` and `topic` parameters. Manual selector changes do not count as generated spins.

Deploy the production build, visit the published site, and complete a spin to verify `spin_generated` in GA4's Realtime report.

### Landing-page totals

The landing page reads `/api/stats` on load, after a completed spin, every minute while visible, and when returning to the tab. The server queries GA4 for the total `spin_generated` event count and total `sessions` (website visits), from January 1, 2020 through today. These differ from active users and the count of all events shown on the GA home screen. Totals use processed reports, so they do not update immediately after a visit or spin: [Google documents processing delays of 24–48 hours](https://support.google.com/analytics/answer/11198161). Successful results are cached for up to five minutes across the server and CDN. Refreshing does not bypass Analytics processing. A confirmed empty report displays `0`; an initial failure displays a dash, and a failed refresh preserves the last reported totals. The next refresh retries automatically.

To check collection immediately, use GA4 **Reports → Realtime** and look for `spin_generated` after **Spin now** or **Generate Again** finishes. Set a standard report's date range to include today when comparing recent tests. The public total comes from processed reports, not Realtime. An immediate shared counter would require a separate persistent database; this integration never invents increments locally or combines overlapping Realtime and historical reports.

To enable live totals:

1. Enable the **Google Analytics Data API** in a Google Cloud project and create a service account. Follow the [Google Analytics API setup guide](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart).
2. In Google Analytics, open **Admin → Property access management** for Spin2Build and add the service account's email with the **Viewer** role.
3. Create a JSON key for that service account. In the hosting project's server environment settings, set `GA_PROPERTY_ID` to `553743552` (the property in the supplied screenshot), `GA_CLIENT_EMAIL` to the JSON's `client_email`, and `GA_PRIVATE_KEY` to its `private_key`. Actual newlines or literal `\n` separators are both accepted. Keep these values server-only; do not prefix them with `VITE_` or commit the key.
4. Deploy the updated project. The endpoint in `api/stats.ts` uses a [Vercel Node.js function](https://vercel.com/docs/functions/runtimes/node-js); other hosts need an equivalent server route. A static upload of `dist` alone cannot serve it.
5. Visit `/api/stats` on the deployed domain. A working connection returns JSON with `totalSpins` and `totalVisits`. A `503` means the server settings, Data API enablement, property permissions, or upstream service need checking.

For local development, copy `.env.example` to `.env.local`, fill in the service account settings, and restart `npm run dev` or `npm run preview`. Vite serves the same endpoint locally. `npm run build` also type-checks the server code. Run `npm test` with Node.js 22.18+ to check report handling, caching, and failure responses using mocked Google reports. The credentials and Google authentication library are never bundled into the browser app.
