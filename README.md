# spin2build

A minimalist project idea generator built with Vue 3, TypeScript, and Vite. Pair 15 project types with 121 topics, then generate a detailed starting point locally.

Run `npm install` and `npm run dev` to start. `npm run build` checks TypeScript and produces the production site in `dist`; `npm run preview` serves that build.

Use **spin now**, **Generate Again**, or the header arrow to spin both selectors. Each selector also supports previous/next buttons, ArrowUp/ArrowDown when focused, mouse wheel, and vertical touch swipes. Reduced-motion preferences skip the long animation.

**Copy Idea** copies the short project sentence (requires localhost or HTTPS and clipboard permission). **Generate Idea** selects a local template with no API calls. The gallery provides example combinations to load into the generator.

Edit `src/data/projectTypes.ts`, `src/data/topics.ts`, and `src/data/ideas.ts` to customize the choices and templates. Animation logic lives in `src/composables/useSpinner.ts`; the shared selector is `src/components/TextSpinner.vue`.

Google Analytics uses measurement ID `G-Z408WTQHSV`. Tracking runs in production builds (including `npm run preview`), and is disabled during `npm run dev`. The Google tag collects page views and sessions; `spin_generated` is sent once after both selectors finish, with `project_type` and `topic` parameters. Manual selector changes do not count as generated spins.

Deploy the production build, visit the published site, and complete a spin to verify `spin_generated` in GA4's Realtime report. Homepage totals still require a separate server-side Analytics Data API connection; the measurement ID enables collection but cannot read report totals.
