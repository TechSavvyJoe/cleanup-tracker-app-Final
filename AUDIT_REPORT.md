# Audit report & remediation plan

Summary
-------
- Ran dependency audits for server and client during CI and locally.
- Findings (high level):
  - Server: 2 moderate vulnerabilities (validator via express-validator). No non-breaking fix available.
  - Client: 3 moderate vulnerabilities (webpack-dev-server via react-scripts). Fix requires breaking upgrade (react-scripts change).

What I attempted
-----------------
- Executed `npm audit fix --omit=dev` in `server` and `client` to apply safe, non-breaking fixes.
- The local terminal/session became unstable while finishing the audit-fix steps, so I aborted further automated fixes to avoid inconsistent state.

Recommended next steps
----------------------
1. Decide lockfile policy
   - Prefer committing `package-lock.json` for both `server` and `client` (recommended). This enables reproducible installs and makes `npm ci` safe to use in CI.

2. Apply non-breaking audit fixes (safe approach)
   - On a dedicated branch, run:

```bash
git checkout -b chore/apply-safe-audit-fixes
cd server
npm audit fix --omit=dev
# review package-lock.json changes, run server tests (if any)
cd ../client
npm audit fix --omit=dev
npm run lint
npm test -- --watchAll=false
npm run build
cd ..
git add -A
git commit -m "chore: apply safe npm audit fixes (non-force) for server and client"
git push origin HEAD
gh pr create --title "chore: apply safe npm audit fixes" --body "Applied non-breaking npm audit fixes and updated lockfiles" --base main
```

3. If `npm audit fix --omit=dev` does not resolve all advisories
   - For each remaining advisory, evaluate whether it can be mitigated by:
     - Updating a direct dependency to a non-breaking minor/patch version
     - Replacing the dependency if it is unmaintained
     - Accepting the risk with documented rationale

4. For advisories that require breaking changes (client react-scripts)
   - Create a separate upgrade branch to update `react-scripts` and/or major transitive dependencies. Run full app QA (manual flows) because CRA upgrades can be breaking.

5. CI policy change (optional)
   - After committing lockfiles, change CI to prefer `npm ci` (fast, reproducible). Keep fallback to `npm install` only for legacy branches if desired.

Notes / Blockers
----------------
- The interactive terminal used here experienced restarts and interruptions while running `npm audit fix`. To avoid partial/inconsistent commits, I stopped automated changes and created this plan.
- I can re-run the safe audit-fix flow in a stable environment (local machine or CI runner) and open a PR with the results. If you want, I can do that now.

Acceptance criteria for PR
-------------------------
- Only non-breaking changes in `package.json`/`package-lock.json` (no forced `--force` changes).
- Client lint/tests/build pass locally and in CI.
- CI green on the PR.

Contact me which path you prefer: safe fixes now, or staged breaking upgrades later.
