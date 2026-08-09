# 15 — Bump the GitHub Actions to v5

Status: ready-for-agent

## What to build

The Pages workflow logs a Node 20 deprecation warning on `actions/checkout@v4`,
`actions/setup-node@v4`, `actions/upload-artifact@v4` and
`actions/deploy-pages@v4`. Harmless today, but it is the only known outstanding
item from the first nine issues and it will stop being harmless.

Bump each to `@v5`, check the v5 release notes for input renames rather than
assuming the interfaces are identical, and confirm the workflow still builds and
deploys.

Pushing to `main` deploys to Pages, so this must be verified on a branch before
it merges.

## Acceptance criteria

- [ ] All four actions pinned at `@v5`
- [ ] Any renamed or removed inputs handled, not silently dropped
- [ ] The workflow runs green on a branch and produces the same build output
- [ ] No Node deprecation warnings remain in the run log

## Blocked by

- None - can start immediately
