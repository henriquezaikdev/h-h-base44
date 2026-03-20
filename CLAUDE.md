# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Vite HMR)
npm run build    # Type-check (tsc -b) then bundle for production
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
```

No test framework is configured yet.

## Environment

The app requires a `.env.local` file with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

All Vite env vars must be prefixed with `VITE_` to be accessible in the browser.

## Architecture

React 19 SPA using:
- **Vite** — build tool with `@vitejs/plugin-react` (Oxc-based)
- **React Router DOM** — client-side routing
- **TanStack React Query** — server state and data fetching
- **Supabase** — backend (auth, database, realtime) via `src/lib/supabase.ts`
- **Tailwind CSS 4** — utility-first styling

Entry point: `index.html` → `src/main.tsx` → `src/App.tsx`

The Supabase client is initialized in `src/lib/supabase.ts` and should be imported from there throughout the app.

## TypeScript

Strict mode is fully enabled — `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedSideEffectImports` are all on. Fix all TypeScript errors before building; `tsc -b` runs as part of `npm run build`.
