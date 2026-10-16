# Code-quality review: 16 October 2026

Ran [Fallow](https://github.com/fallow-rs/fallow) 3.33.1 against the local working tree. Changes are local on `refactor/fallow-cleanup`, with no publication or installed-client update.

## Implemented

`TranscriptParser` now delegates provider interpretation to the abstract `TranscriptDecoder` contract. `CodexTranscriptDecoder` and `ClaudeTranscriptDecoder` retain their distinct turn/tool semantics; common timestamp validation, identifier hashing, privacy normalization and stable event IDs remain in the host parser. A strategy is selected once per transcript. Version checks and workspace membership were preserved.

The decoder module has only a type import: no filesystem, DOM, network or clock dependency. It can execute unchanged in Node and a browser bundle (runtime isomorphism). This adds no browser observation or external provider API. The [C4 component and class diagrams](../ARCHITECTURE.md) show the implemented relationships.

`.fallowrc.json` declares esbuild's hook, guild and extension-test roots plus manually invoked scripts. It excludes generated/artifact/local-pack paths. These entries prevent deletion of real runtime roots which the default scan called unused.

## Remaining findings

The configured run reports 12 graph/dependency findings (11 unused exports and a packaging dependency warning), zero clone groups, 123 complexity findings and zero import cycles. Most named constants are used internally, so at most their export modifier needs review; their definitions must not be deleted wholesale. `@vscode/vsce` remains development packaging tooling.

Prioritize typed extension message handlers and webview render layers: `app.ts:render` cyclomatic 162, `draw` 90 and the extension message callback 84. `decodePng` (58) and the state reducer (56) require format/state fixtures before further splitting. Moving branches between methods alone does not improve total complexity or prove speed gains.

No boundary rules or rule packs were configured; zero policy counts do not demonstrate enforced layering. Coverage estimates are not runtime coverage. Fallow's JS/TS graph does not review the C# widget or Python importers semantically. The initial unconfigured run reported 21 graph findings; configuration changes account for much of the difference.

## Validation

- Typecheck and build passed.
- Full source test suite: 72 passed, 1 failed. The existing local-pack test cannot read `assets/local/sources/scenery/bg_list.dat`; its manifest references the missing file. The asset module and test were unchanged. Preserve the receipt/hash checks and repair or re-import the local pack deliberately.
- Comparison against the original `TranscriptParser`: identical events for 1,500 synthetic records covering both providers, malformed/ignored records, turn changes, pulses, tools and finish/interrupt paths.
- Browser-platform bundle of `transcript-decoder.ts` passed. The watcher still runs only in the extension host.
- Architecture diagrams rendered in Chromium; whitespace checks passed.

## Reproduce

```powershell
npx --yes fallow@3.33.1 --format json --no-cache
npx --yes fallow@3.33.1 architecture --format json
npm run typecheck
npm test
npm run build
```

Keep raw reports, transcript probes, local assets and replay exports out of Git. No paid features or telemetry were enabled. No native client or release validation is claimed by these checks.

## User-facing preservation check

Follow-up verification on 16 October: `npm run test:browser` passed motion, stable placement, journal, links, demo isolation, credits, the storage system and narrow layout. No view HTML, CSS or renderer source was changed by this cleanup; the parser comparison above covers the observation-side event contract. Installed native-client behaviour was not re-tested.

## PR integration validation

Prepared from current main `fecd60c`. A fresh source-only install passed typecheck, build and all 69 available tests; 4 local-pack tests skipped because artwork is deliberately not part of the repository. The earlier partial-pack failure describes the original development checkout. Fallow diff audit found no introduced dead code or duplication; it attributes two moved decoder methods as new complexity because they now live in a new file. Their branches were extracted from the original parser and the event-equivalence check remains applicable.
