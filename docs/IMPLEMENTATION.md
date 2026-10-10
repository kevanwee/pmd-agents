# Guild implementation — updated 10 October 2026

The owner authorized building after the planning pass. This branch delivers a first usable slice, not the entire roadmap.

## 0.2.0: Substitute training, Kanto roster and guided hook installation

Delivered 10 October 2026. Working, editing and shell-running states now train against the authentic Substitute sprite (`sprite/0000/0001`). Reading patrols and returns to its reserved station before attacking. Native Attack/Shoot timing alternates, with head-offset projectile origins, original element-coloured particles and Substitute Hurt frames. Attention, stale observation, Quiet, reduced motion and hidden panels stop training. Cycles are cosmetic, not tool counts, damage or completion signals. Older packs retain a procedural dummy fallback.

The local import now includes all nine Bulbasaur/Charmander/Squirtle line stages plus Eevee, Riolu and Ceruledge. `assets/roster.json` drives staged expansion. The importer preserves original PNGs, sprite/portrait credits, native timing, head/shadow offsets and 238 source receipts. The manifest is replaced only after a complete import. Runtime validation covers the optional Shoot and dummy sheets; existing default character assignments stay stable when the roster grows. Credits identify every imported contributor, including two unresolved upstream Discord credit IDs.

Connections now offers Connect Codex / Connect Claude, an in-panel settings destination and observer-only preview, and an explicit Install hooks button. It no longer opens an unexplained untitled JSON editor. The installer preserves other settings, writes an exact backup before changing configuration, refuses stale previews and repairs a missing observer helper on repeat installation. Codex trust stays with the user. Tests use temporary provider directories, never global provider configuration.

Historical Codex discovery rotates 16 older date directories per scan (up to 366 directories within the newest eight year directories), while checking the last three UTC dates each time. Previously watched logs stay watched outside the current batch; only recently modified, workspace-matching, supported records qualify. Connections reports scan progress. This improves resumed old threads without inferring window membership.

Validation: 36 focused tests, typecheck, production bundles, browser checks for generic-working impacts/projectiles, all nine starter selections, attention stops, hook installation controls, 320px layout, and the existing real VS Code terminal/webview integration. Four refreshed, labelled demo screenshots document the result. Live Claude native-chat, approval/subagent coverage and durable attachment restoration remain outstanding.

The private GitHub repository is `kevanwee/pmd-agents`. Actions run 37970945659 could not start its job because of account billing/spending restrictions; local checks ran successfully. Billing was not changed.

## 0.1.2: stable teammates and an activity journal

`src/placement.ts` reserves a position per visible session while the guild view is open. Removing, linking or reordering another session no longer teleports surviving actors. Freed slots can be reused; later clearings remain reachable even when earlier ones empty. Attention sorts the roster independently of map placement. This is presentation state, not persisted window membership, and resets when the view is recreated.

`src/journal.ts` records the last 32 accepted event categories per tracked session, with original timestamps and observation source. It retains no chat text, commands, paths, tool IDs or tool payloads. Consecutive generation pulses coalesce. History is bounded by the existing 128-session store, pruned with evicted sessions and never written to disk. The Activity tab explains the selected actor's current motion and lists observations; up to eight recently closed attached sessions can be selected there. Demo history is isolated and labelled simulated.

The reducer now explicitly reports whether an event was accepted. Duplicate, late settled-turn and already-ended tool events do not enter the journal or refresh source evidence. Known tool completions arriving after an unnumbered turn finishes cannot restart its animation. Source formats without turn IDs still cannot provide perfect ordering for every unknown tool.

Validation: 32 focused tests; browser checks for actual patrol movement, approval stops, stable survivor coordinates, sparse clearing navigation, journal contents, closed-session inspection and narrow controls; a real VS Code terminal test confirms accepted shell events reach the journal. Browser checks start their own disposable local preview server. Journal screenshots produced by browser fixtures are test replays, not captures of a live user's chat.

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

Discovery checks the last three UTC Codex date directories, bounded batches of older folders (see 0.2.0 above), and each workspace's Claude project directory. It considers files modified within 12 hours, scans at most 64 recent candidates and tracks at most 16 matching sessions. Each initial read and polling read is capped at 1 MiB; partial history is labelled. Byte offsets remain stable across split UTF-8 reads; truncation resets parsing. Unsupported versions are skipped. Tested/inspected version families: Codex 0.153/0.159/0.162, Claude 2.1.289/2.1.292. These local formats are private and may change.

Native sessions always start unbound; directory equality does not establish window ownership. Non-startup hooks take priority; fresh transcript recovery after hook silence is described above. A missing hook with no newer evidence produces stale status, not fabricated completion. Transcript-only observation does not prove approval waits, child identities or exact-chat focus. Remote hosts require logs in that extension host's filesystem.

The sanitized `artifacts/transcript-probe.json` records 29 tool starts, 28 tool ends, one failure and one new turn from a local Codex VS Code session, including two events written during the probe. It contains no chat text or paths. Run `npx tsx scripts/probe-transcripts.ts <workspace-directory>` to repeat.

## Artwork

The importer pins SpriteCollab revision `47e5b9920bc5b2b491c53b18076300dc6813f103`, validates dimensions and directions, resolves aliases, and reads white shadow anchors. [PMD Sprite Format](https://wiki.pmdo.pmdcollab.org/PMD_Sprite_Format) defines durations in 1/60-second units. Source PNGs are unchanged.

Ignored `assets/local` contains the pack, source records, original credit files and SHA-256 receipts. Python and Pillow are required to import it. The existing Voracity map and font are read without modifying Voracity. The map's exact original ripper remains unresolved.

Eevee and Riolu sprite records identify CHUNSOFT with Unspecified licence markers. Ceruledge identifies baronessfaron with historical terms. Portrait records also name Fearless-Quit and Top_Kec. The repository's general CC BY-NC notice is not a claim that every original game sprite is licensed fan art. Artwork is excluded from Git and the VSIX.

The tree is conservatively blocked; no foreground mask is fabricated. Training dummies use imported Substitute Idle/Hurt sheets; older packs fall back to an original procedural prop. Move particles are original decorative effects. Six positions appear per clearing page; all sessions remain in the roster. Full pathfinding, map editing, NPC sparring and dungeon expeditions are not implemented.

## Validation

- TypeScript typecheck and production bundles.
- Thirty-six focused tests cover state ordering, attention, redaction, source recovery, window membership/linking, bounded journal history, stable placement, native transcript parsing, asset integrity and local transport.
- Playwright: demo isolation, roster, credits, paused simulation and 320px layout; desktop and narrow screenshots visually inspected.
- Real VS Code: terminal lifecycle, shell command, webview ready and unbound hook candidate.
- Actual CLI startup probes described above.

Screenshots, probe state and logs stay in ignored `artifacts`. No paid service, global provider setting or existing Voracity file was changed by these tests.

## Next increment

Exercise live native Claude chat and both clients after hook setup/trust, including approval/input and child agents. Establish durable window identity for attachment restoration and improve process reconciliation before expanding maps.
