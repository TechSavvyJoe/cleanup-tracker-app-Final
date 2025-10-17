# Audit report — safe remediation plan

Date: 2025-10-16

This document summarizes the results of `npm audit` run locally for the repository and recommends safe next steps.

## Summary

- Client (frontend): 3 moderate vulnerabilities found. Root cause: vulnerable versions of `webpack-dev-server` used indirectly via `react-scripts`. Fix requires upgrading `react-scripts` which is a breaking change and may require code changes and retesting. `npm audit fix --force` would attempt this but is not safe to run automatically.
- Server (backend): 2 moderate vulnerabilities found. Root cause: `validator` used by `express-validator` has a URL validation bypass advisory. No non-breaking fix available via `npm audit fix`; this requires dependency review and potential upgrade of `express-validator` when upstream fixes are released.

## Actions already taken

- Added CI validation that authenticates and validates `/api/v2/diag` to catch regressions (PR #1).
- Added `scripts/run-local-ci.sh` to reproduce CI steps locally (lint, build, tests, start server, authenticated diag-check, audit).

## Recommended remediation steps (safe path)

1. Do NOT run `npm audit fix --force` on `client` unless you accept the risk of major changes to `react-scripts`.

2. For the server (`express-validator` / `validator`):
   - Monitor upstream `express-validator` and `validator` releases for fixes.
   - If a fixed version becomes available, update `express-validator` in `server/package.json` and run full test pass.
   - In the meantime, consider adding input validation hardening for any user-supplied URLs used by the app as a mitigation.

3. For the client (`react-scripts` / `webpack-dev-server`):
   - Create a dedicated branch to upgrade `react-scripts` (and/or `@pmmmwh/react-refresh-webpack-plugin`) and run the full test/build cycle.
   - Perform manual smoke tests of the UI after upgrade; fix any breaking API changes.

4. Lockfile policy (repo-specific):
   - This repository currently ignores `package-lock.json` files. For reproducible builds and clearer audit remediations, consider committing lockfiles for server and client so audit fixes can be tracked. If you prefer not to commit lockfiles, maintain an internal process for lockfile generation in CI.

## Proposed immediate tasks (I can implement these)

- Open PR that documents the audit results and proposed plan (this PR).
- Create a follow-up PR to upgrade `react-scripts` on a feature branch and run full tests (I can create the branch and run the upgrade; will require manual QA).
- Monitor for upstream fixes to `express-validator` and plan server dependency update when available.

---
If you'd like, I will: (A) create the upgrade branch and attempt a non-breaking `react-scripts` update and run the full local CI script, or (B) run `npm audit fix --force` in a separate branch and run all tests (risky). Tell me which approach to take and I'll implement it on a PR.
