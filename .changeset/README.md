# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

To record a change that should ship in the next release:

```bash
pnpm changeset
```

Pick the bump (patch/minor/major for `cn`) and describe the change — the
description becomes the CHANGELOG entry. Commit the generated markdown file
with your change.

On push to `main`, the release workflow collects pending changesets into a
"Version Packages" PR. Merging that PR bumps `cn`'s version, updates its
CHANGELOG, and publishes to npm (with provenance) after the full gate set —
build, differential parity suites, and the bundle-size gate — passes.

The `conformance` package is private and is never versioned or published.
