# Release checklist

Version 0.5.1 is the first public GitHub release. Use this checklist for later
releases as well. Packaging checks do not constitute legal clearance. Keep
private IP review notes out of Git.

## Before packaging

- Review the intended distribution basis for code, screenshots, branding,
  dependencies and the artwork importer. Record any permission privately and
  its scope, and disclose unresolved questions to the owner before publication.
  An excluded asset pack does not resolve all of those questions. The owner
  explicitly authorised publication of the fan version on 12 October 2026 after
  the risk discussion; that instruction is not third-party permission.
- Confirm the target platforms and live-provider claims against dated evidence.
  Do not describe live Claude, remote hosts or non-Windows support as verified.
- Update `package.json`, `package-lock.json`, README and the release notes together.
- Review the complete PR diff and run source checks. Merge the reviewed PR, then
  build the exact clean main commit to be tagged.

## Build on Windows x64

Use Node.js 22+, Python 3, npm and the .NET Framework compiler shipped with
Windows. The build downloads the hash-pinned WebView2 SDK. Pillow and an artwork
pack are needed for the existing artwork/browser tests, not the VSIX build.

```powershell
npm ci
npm run typecheck
npm test
npm run package
npx playwright install chromium
npm run test:browser
npm run test:widget
npm run test:extension
npm run test:native
npm run test:package
```

`npm run package` derives the filename from the manifest version, builds the
native companion, rejects unexpected package files, compares packaged bytes to
the build, and writes a matching `.vsix.sha256`. The allowlist includes the
Microsoft WebView2 notice and original-code licence; it excludes game asset
directories, screenshots, tests and personal artifacts. It does not audit legal
rights or prove that compiled code contains no embedded third-party content.
`test:package` installs this VSIX in an isolated profile and checks startup with
an explicitly empty pack directory, avoiding the developer's existing assets.

Before publication, separately exercise a permitted compatible pack from the
documented path, verify native minimize/restore/dismiss on two windows, and check
the downloaded release checksum. Preserve the validation record and commit SHA.
Record skipped checks and unsupported clients rather than claiming they passed.

## Draft and publish

Create a **draft** after the owner has selected the distribution direction. A draft is
not an announcement or a completed release. Use the exact reviewed commit:

```powershell
$releaseCommit = git rev-parse HEAD
gh release create v0.5.1 artifacts/pmd-agents-0.5.1.vsix artifacts/pmd-agents-0.5.1.vsix.sha256 --repo kevanwee/pmd-agents --target $releaseCommit --title 'PMD Agents 0.5.1' --notes-file docs/releases/0.5.1.md --draft
```

Inspect the draft's commit, notes, files and checksums. When publication is
authorised after any outstanding distribution questions are disclosed, publish it in GitHub's
release editor. Then download the public files and compare their hashes with the
tested files. Update README's release-status notice as part of that release.
Keep the tag fixed; make a new patch release for corrections. Never replace an
existing public asset silently. Marketplace publication is a separate channel.

Existing CI runs source checks only. These steps use existing local tools; no
paid CI runner or new hosted service is required.
