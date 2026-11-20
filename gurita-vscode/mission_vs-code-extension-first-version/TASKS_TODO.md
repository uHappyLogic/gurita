# TASKS TODO

## Override Vulnerable Minimatch Under Vsce

Add an npm `overrides` entry to `gurita-vscode/package.json` forcing `@vscode/vsce` 4.1.1's transitive `minimatch` to `^11.0.1`, and regenerate `package-lock.json`, so that `npm ci` no longer reports the two moderate vulnerabilities of GHSA-g3hv-75wg-m249 (range `>=7.0.0 <11.0.1`); `@vscode/vsce` stays pinned at `4.1.1` rather than being downgraded by `npm audit fix --force`. Verified by `npm ci` then `npm audit` reporting `found 0 vulnerabilities` and `npm run package` still producing `dist/gurita-vscode.vsix` with the same file list.

---
