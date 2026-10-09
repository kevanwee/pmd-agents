# Guild implementation — updated 10 October 2026

The owner authorized building after the planning pass. This branch delivers a first usable slice, not the entire roadmap.

## 0.1.1: visible work and session management

The owner reported Eevee standing still while Codex was thinking/outputting. Generic Working now follows a short checked patrol using Walk frames. Explicit editing retains dummy attacks; approval/input, unknown stale state, lost observation, Quiet and reduced motion stop movement. Native reasoning/assistant record metadata produces a `pulse` that refreshes observed activity without inspecting or retaining text, clearing attention, or claiming completion.

Connections now supports explicit agent-to-terminal links, unlinking, removing a session from the guild and rescanning. A linked terminal is represented by its agent in the map; both identities remain intact. Several agents can share an explicitly linked terminal. Closing a terminal removes the link without declaring the provider session ended. Removal persists for this activation even when direct hooks arrive; reattachment is deliberate. Links are activation-local and must be restored after reload.

Source switching lives in `src/sessions.ts`. Hook events take priority over transcript replay. If hooks have been quiet for two minutes, a fresh transcript event newer than the last hook can recover observation; elapsed time alone never changes the outcome. Switching sources clears incomplete tool bookkeeping and labels fallback history partial. Missing/read-failed files show Observation unavailable; disabling observation immediately shows Observation paused. Reappearance revalidates workspace/client metadata. The scan reports watched-file, unsupported and error counts. Claude's `CLAUDE_CONFIG_DIR` is honored.

Validation: 26 tests, TypeScript, browser checks including actual patrol displacement/approval stop, link visibility, narrow management controls, and a real VS Code terminal/link lifecycle test. A historical replay of two actual native Claude 2.1.289 files produced 87 tool starts, 88 tool ends and 15 turn finishes from bounded tails. These files were approximately 49 and 72 hours old, so they are deliberately excluded from automatic live discovery. This proves decoding of actual native records, not a live Claude session. The sanitized replay report stays in ignored artifacts.

## Implemented

- VS Code extension with terminal discovery, actual shell command start/end and terminal closure.
- Authenticated local event receiver and separate Codex/Claude observer. New terminals receive a window registration ID. Unbound hook events remain candidates until explicitly attached.
- Bounded, read-only native transcript observation for recent workspace chats, with explicit candidate attachment and client/source labels.
- Provider normalization, concurrent tool tracking, attention, turn outcomes, child identities where supplied, bounded deduplication and stale-status labels.
- Thunder Meadow with conservative tree/cliff exclusions, checked short movement paths, attacks against a training dummy, directional PMD sheets and per-frame shadow anchors.
- Eevee, Riolu and Ceruledge, portraits, character selection, source-panel/terminal navigation, quiet/reduced-motion modes, credits and isolated demo mode.
- Hook setup preserves unrelated settings, previews the result, backs up the file, checks for concurrent edits and supports surgical removal.

This slice uses TypeScript, DOM controls and Canvas, with esbuild. React/Vite from the proposal are unnecessary for the current small UI. The code, event reducer and renderer remain separate.

## Evidence and support

| Surface | Evidence | Status |
| --- | --- | --- |
| VS Code terminal | Real Extension Development Host: terminal open, shell integration command, exit and close; webview JavaScript ready handshake | Verified locally |
| Claude CLI startup | Installed CLI emitted SessionStart through a temporary observer configuration before rejecting empty print input; no inference submitted | Startup verified; live turns unverified |
| Codex app-server startup | Installed binary initialized and accepted thread/start with isolated CODEX_HOME; no hook event observed; no inference submitted | Startup protocol verified; observation unproven |
| Claude native VS Code chat | Actual 2.1.289 records replayed through parser; 2.1.292 schema inspected; synthetic turn/tool fixtures pass | Historical records verified; live connection unverified |
| Codex native VS Code chat | Read actual 0.162.0-alpha.2 session transcript; 2 new events written during a 15-second probe, no read errors | Native transcript observation verified; hooks/approval coverage unverified |
| Two windows | Two actual receivers and observer subprocesses: bound event reaches one; unbound event remains a candidate in both | Routing verified; two full interactive editor windows still need live testing |
| Other/nested tools | Terminal observes coarse shell activity; semantic detail needs hooks | Limited |
| WSL / SSH / containers | Not exercised | Unverified |

Run `npx tsx scripts/probe-clients.ts` for the startup probes. Their saved summary contains only provider, result and normalized event kinds. They do not submit a model prompt or use permission/trust bypasses. CLI probes do not prove IDE chat support.

## Behaviour and limits

`src/core.ts` owns state; `src/provider.ts` discards prompts, arguments, results and paths before IPC. Provider IDs are hashed. A tool ending does not complete its turn. A freshness timeout never produces success. Generic commands report exit status, not inferred test outcomes.

The receiver binds loopback, authenticates with a random token, rejects browser Origin headers and unknown payload fields, and limits request size. There is no raw event log. Local registration files are bearer capabilities. The observer checks up to 32 registrations and exits quietly within 1.5 seconds if delivery fails.

Manual attachment is activation-local: VS Code workspaceState can be shared by windows on the same folder, so restoring attachments from it risks cross-window binding. Reattach unbound chats after reload. Cosmetic character choices are saved per workspace/provider-session ID. Generic terminal identity lasts for the activation.

The store is capped at 128 sessions and bounded event/tombstone sets. Full process reconciliation and attachment restoration across extension reload remain future work. Some provider events lack turn IDs, limiting perfect ordering across turns. Child activity without a child ID cannot be assigned merely from timing. Agent/terminal grouping is explicit; no ownership is guessed from folder or timing.

Source navigation opens a terminal or the provider's panel. Exact native-chat conversation focus is not claimed. Hook installation is offered through the extension; trust is never silently granted.

## Native transcript fallback

`src/transcripts.ts` reads activity structure from local Codex/Claude JSONL files. Prompts, message text, tool arguments and outputs are discarded; paths are used locally for workspace filtering, and only the project basename is displayed. Nothing is uploaded. Disable `pmdAgents.observeLocalChats` to stop reading, then reload to clear retained session state.

Discovery checks the last three UTC Codex date directories and each workspace's Claude project directory. It considers files modified within 12 hours, scans at most 64 recent candidates and tracks at most 16 matching sessions. Each initial read and polling read is capped at 1 MiB; partial history is labelled. Byte offsets remain stable across split UTF-8 reads; truncation resets parsing. Unsupported versions are skipped. Tested/inspected version families: Codex 0.153/0.159/0.162, Claude 2.1.289/2.1.292. These local formats are private and may change.

Native sessions always start unbound; directory equality does not establish window ownership. Non-startup hooks take priority; fresh transcript recovery after hook silence is described above. A missing hook with no newer evidence produces stale status, not fabricated completion. Transcript-only observation does not prove approval waits, child identities or exact-chat focus. Remote hosts require logs in that extension host's filesystem.

The sanitized `artifacts/transcript-probe.json` records 29 tool starts, 28 tool ends, one failure and one new turn from a local Codex VS Code session, including two events written during the probe. It contains no chat text or paths. Run `npx tsx scripts/probe-transcripts.ts <workspace-directory>` to repeat.

## Artwork

The importer pins SpriteCollab revision `47e5b9920bc5b2b491c53b18076300dc6813f103`, validates dimensions and directions, resolves aliases, and reads white shadow anchors. [PMD Sprite Format](https://wiki.pmdo.pmdcollab.org/PMD_Sprite_Format) defines durations in 1/60-second units. Source PNGs are unchanged.

Ignored `assets/local` contains the pack, source records, original credit files and SHA-256 receipts. Python and Pillow are required to import it. The existing Voracity map and font are read without modifying Voracity. The map's exact original ripper remains unresolved.

Eevee and Riolu sprite records identify CHUNSOFT with Unspecified licence markers. Ceruledge identifies baronessfaron with historical terms. Portrait records also name Fearless-Quit and Top_Kec. The repository's general CC BY-NC notice is not a claim that every original game sprite is licensed fan art. Artwork is excluded from Git and the VSIX.

The tree is conservatively blocked; no foreground mask is fabricated. Training dummies are original procedural props. Six positions appear per clearing page; all sessions remain in the roster. Full pathfinding, map editing, NPC sparring and dungeon expeditions are not implemented.

## Validation

- TypeScript typecheck and production bundles.
- Twenty-six focused tests: concurrent/reordered events, attention, generation pulses, stale state, redaction, child identity, wire validation, hook merge/removal, geometry, animation timing, asset hashes, two-receiver routing, native transcript reconstruction, version/workspace gates, split UTF-8/truncation handling, source recovery and session membership/linking.
- Playwright: demo isolation, roster, credits, paused simulation and 320px layout; desktop and narrow screenshots visually inspected.
- Real VS Code: terminal lifecycle, shell command, webview ready and unbound hook candidate.
- Actual CLI startup probes described above.

Screenshots, probe state and logs stay in ignored `artifacts`. No paid service, global provider setting or existing Voracity file was changed by these tests.

## Next increment

Exercise live native Claude chat and both clients after hook setup/trust, including approval/input and child agents. Establish durable window identity for attachment restoration and improve process reconciliation before expanding maps.
