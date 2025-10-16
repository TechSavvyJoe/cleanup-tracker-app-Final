# Create React App → Modern Toolchain Migration Plan

## Why move now?

- CRA’s `webpack-dev-server` still carries an open security advisory (GHSA-9jgg-88mc-972h). We mitigate via dependency overrides, but the risk remains until we leave the legacy dev server.
- A modern bundler (Vite or Next.js) gives faster HMR, smaller bundles by default, and first-class TypeScript/SWC support.
- Removing CRA simplifies dependency maintenance—no more patch-package overrides for transitive issues.

## Migration phases

1. **Proof of concept**
   - Prototype a Vite React build (or Next.js if SSR/routes are desired) alongside the existing CRA app.
   - Port the current `src` entry point and global styles.
   - Stub `/api` proxy behaviour to match `setupProxy.js`.
   - Validate Jest + React Testing Library works (Vite: `vitest` or keep Jest via `vite-node`).

2. **Parity checklist**
   - Recreate custom webpack aliases and environment variable usage.
   - Ensure Tailwind/PostCSS pipeline matches the CRA output (check `postcss.config.js` and global CSS variables).
   - Confirm auth/session handling still works with the new dev server proxy.
   - Exercise smoke flows: detailer job creation, salesperson QC, inventory editing/printing, report exports.

3. **Tooling updates**
   - Replace `react-scripts` commands in `package.json` with the chosen tool’s scripts (`vite dev`, `vite build`, etc.).
   - Swap ESLint/Prettier configs if the new toolchain provides templates (e.g., Next.js).
   - Update TypeScript config if applicable (`tsconfig.json`, `paths`).
   - Refresh Dockerfile and deployment scripts to use the new build command.

4. **Cutover**
   - Remove CRA-specific files (`src/setupProxy.js`, `config-overrides`, service worker boilerplate).
   - Drop patch-package overrides tied to CRA dependencies.
   - Update documentation (README, deployment guides) with the new commands.
   - Archive the CRA branch/tag for reference.

5. **Post-migration**
   - Monitor bundle sizes and dev-server performance; tweak Vite/Next config as needed.
   - Revisit automated tests—consider adopting Playwright/Cypress for e2e now that the build is faster.
   - Schedule periodic dependency audits; the modern toolchain should reduce the noise.

## Decision matrix

| Option  | Pros | Cons |
|---------|------|------|
| **Vite** | Fast dev server, simple migration, JSX parity | Still SPA-only (no SSR/SSG) |
| **Next.js** | Built-in routing, SSR/SSG, API routes | Larger migration surface, more opinionated |

Given this project’s existing single-page architecture, Vite is the recommended first step. Revisit Next.js if you need server-side rendering or SEO-focused routes later.
