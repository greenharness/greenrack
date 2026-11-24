---
'@greenharness/greenrack-cli': minor
---

The generated session hook runs the repo's own `node_modules/.bin/greenrack` when its version is in `^7.0.0`, the copy the lockfile pins and a commit gate's `greenrack doctor` runs, and `npx` otherwise. It works offline and skips the registry round trip, and a local upgrade refetches the catalog and reruns the doctor. Existing installs read as stale under `hook install --check` until `npx -y @greenharness/greenrack-cli@^7 hook install` regenerates the script.
