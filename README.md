# spin2build

A minimalist project idea generator built with Vue 3, TypeScript, and Vite. Pair 15 project types with 121 topics, then generate a detailed starting point locally.

Run `npm install` and `npm run dev` to start. `npm run build` checks TypeScript and produces the production site in `dist`; `npm run preview` serves that build.

Use **spin now**, **Generate Again**, or the header arrow to spin both selectors. Each selector also supports previous/next buttons, ArrowUp/ArrowDown when focused, mouse wheel, and vertical touch swipes. Reduced-motion preferences skip the long animation.

**Copy Idea** copies the short project sentence (requires localhost or HTTPS and clipboard permission). **Generate Idea** selects a local template with no API calls. The gallery provides example combinations to load into the generator.

Edit `src/data/projectTypes.ts`, `src/data/topics.ts`, and `src/data/ideas.ts` to customize the choices and templates. Animation logic lives in `src/composables/useSpinner.ts`; the shared selector is `src/components/TextSpinner.vue`.

Google Analytics uses measurement ID `G-Z408WTQHSV`. Tracking runs in production builds (including `npm run preview`), and is disabled during `npm run dev`. The Google tag collects page views and sessions; `spin_generated` is sent once after both selectors finish, with `project_type` and `topic` parameters. Manual selector changes do not count as generated spins.

Deploy the production build, visit the published site, and complete a spin to verify `spin_generated` in GA4's Realtime report.

### Landing-page totals

The landing page reads `/api/stats`. The server queries GA4 for the total `spin_generated` event count and total `sessions` (website visits), from January 1, 2020 through today. These differ from active users and the count of all events shown on the GA home screen. Totals use processed reports, so they do not update immediately after a visit or spin. Successful results are cached for five minutes. A confirmed empty report displays `0`; missing credentials or failed requests display a dash.

To enable live totals:

1. Enable the **Google Analytics Data API** in a Google Cloud project and create a service account. Follow the [Google Analytics API setup guide](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart).
2. In Google Analytics, open **Admin → Property access management** for Spin2Build and add the service account's email with the **Viewer** role.
3. Create a JSON key for that service account. In the hosting project's server environment settings, set `GA_PROPERTY_ID` to `553743552` (the property in the supplied screenshot), `GA_CLIENT_EMAIL` to the JSON's `client_email`, and `GA_PRIVATE_KEY` to its `private_key`. Actual newlines or literal `\n` separators are both accepted. Keep these values server-only; do not prefix them with `VITE_` or commit the key.
4. Deploy the updated project. The endpoint in `api/stats.ts` uses a [Vercel Node.js function](https://vercel.com/docs/functions/runtimes/node-js); other hosts need an equivalent server route. A static upload of `dist` alone cannot serve it.
5. Visit `/api/stats` on the deployed domain. A working connection returns JSON with `totalSpins` and `totalVisits`. A `503` means the server settings, Data API enablement, property permissions, or upstream service need checking.

For local development, copy `.env.example` to `.env.local`, fill in the service account settings, and restart `npm run dev` or `npm run preview`. Vite serves the same endpoint locally. `npm run build` also type-checks the server code. Run `npm test` with Node.js 22.18+ to check report handling, caching, and failure responses using mocked Google reports. The credentials and Google authentication library are never bundled into the browser app.
