# Guild implementation — updated 10 October 2026

The owner authorized building after the planning pass. This branch delivers a first usable slice, not the entire roadmap.

## 0.4.2: review and reliability corrections

Reviewed 10 October 2026 after PRs #1 and #2 had already merged. See [the findings, remaining risks and PC portability plan](REVIEW-2026-10-10.md).

Attention keeps the native Idle loop while walking and training stop; quiet/reduced motion remain still. Catalog errors wait for an explicit retry. Imports retain the target teammate chosen at the start. Automatic attachment requires a successful workspace lease. Shared asset writes use unique atomic temporary files and cross-process manifest/receipt locks; download streams and PNG inflation are bounded. Package scripts and lockfile now match the documented 0.4.2 build.

Validation: 61 focused tests, typecheck/build, Playwright and isolated real VS Code integration. New coverage includes concurrent processes, cached asset races, failed catalogs, teammate changes during import, attention Idle frames, streamed size limits, PNG bounds and lease-loss recovery. Native live Claude coverage and large-pack/crash recovery remain explicit next work.

## 0.4.1: spawn by default and team dressing

Delivered 10 October 2026. The owner asked for Pokémon to spawn by default and for the Guild team panel to take the left column so the box stays browsable while dressing the team.

`Sessions.autoAttach` attaches every discovered live session (connection observing, not ended, not excluded) with membership `auto`, after workspace auto-connect has claimed its workspace-scoped sessions. The host passes `false` while the workspace lease reports overlapping guild windows; 0.4.2 also pauses on unavailable leases. Turning the `pmdAgents.autoAttach` setting off releases only `auto` members. The Connections tab shows the toggle with its disclosure, the header badge reads Auto-attach, and the portrait card labels such sessions Auto-attached. One unit test covers spawning, exclusions, release and sources that are not observing.

In the storage system, Guild team now replaces the summary panel; selecting a teammate highlights its row, and choosing from the box while the panel is open assigns without closing, with a note of who now has what. Escape closes the menu, then the panel, then the storage. Browser checks cover the panel in the left column, the box staying available, a choice keeping the storage open and the row updating.

## 0.4.0: the Pokémon storage system

Delivered 10 October 2026. The owner asked for a PC like the main-series games: a living Pokédex in National Dex order where a Pokémon opens a menu for choosing it, its forms, or more detail.

`src/dex.ts` reduces SpriteCollab's `tracker.json` (pinned revision `47e5b99`) to a catalog: 1,025 canon species, 4,021 drawn forms, 3,224 marked ready. Forms are the tracker's own subgroups (shiny, female, alternate), labelled from their names; container nodes are skipped; species whose names collapse to one slug carry their number. *Ready* means the tracker records the sprite set as existing (phase 1 or 2). The tracker's per-file flags were checked against upstream and found unrecorded for every recolour and many older uploads, so the phase decides; the importer still verifies every sheet. A sample of ten unflagged phase-1/2 forms all had the four required sheets upstream; four phase-0 samples had none except one, which the catalog therefore under-reports rather than over-promises.

`src/png.ts` decodes PNGs without native dependencies (colour types 0, 2, 3, 4, 6; bit depths 1–16; no interlace). `src/animdata.ts` parses AnimData.xml with CopyOf alias resolution and cycle detection. `src/importer.ts` fetches one form's AnimData, credits, Idle/Walk/Attack/Sleep (and Shoot) sheets, shadow and offset sheets and portrait at the pinned revision, measures anchors and head offsets exactly as the Python importer does, writes receipts and appends the species to the manifest atomically after `validateSpecies` passes. `tests/png.test.ts` proves equivalence: for every local sheet with shadow and offset sources, the TypeScript measurement equals Pillow's stored anchors and head offsets. `src/catalog.ts` builds and caches `dex.json`. The pack validator now reads only PNG headers, so large packs stay cheap to validate; its caps are 1,200 species and a 16 MB manifest.

The owner then asked for the main-series PC layout as the primary view (their reference was the Generation IV box screen: the box of icons on the right, the selected Pokémon's front sprite and types on the left, a bar of actions below) and for every main-series sprite to be imported. `src/gamedata.ts` fetches box icons (Generation VIII style, which the source has through #898; later species show a scaled front sprite), front sprites and shiny fronts from the PokeAPI sprites repository at revision `35fdbe9`, and types from PokeAPI's CSV data at `c807571`, both into `game/` with receipts. A full local run fetched all 2,948 files with none missing. Icons draw at 2x, the DS proportion; measured content bounds show five of 898 icons wider than the slot, which lose a few edge pixels rather than being scaled unevenly. Move colours now cover all eighteen types, and imported species take their primary type from the pack or PokeAPI. The wallpaper, frames, type badges and menus are original CSS.

`src/webview/pc.ts` is the storage view with two layouts sharing one cursor: the game view (primary) and the guild view (SpriteCollab portraits, the menu beside the box), switched with a header button whose choice is remembered in webview state. Both have thirty slots per box, box navigation, search by name or number, arrow/PageUp/PageDown/Home/End keys, a PMD-style menu (Choose / Forms / Summary / Back) with Escape stepping back one level, and focus preserved across asynchronous portrait, sprite and import arrivals. The game view adds a Guild team panel that selects which teammate is being dressed, a shiny front preview while pointing at a shiny form, and a Fetch all game sprites action with host progress. Box portraits are fetched on demand through the host (`dexPortraits`, at most forty per request, four concurrent, cached with receipts in `dex/portraits.json`); choosing an unimported ready form sends `dexImport`, which the host serialises. Forms without a portrait borrow the nearest drawn one and say so. Imported Pokémon default to the neutral move colour unless the pack already records that species' type.

Validation: 54 focused tests (13 new: decoder filters and palettes, AnimData aliases, catalog forms/ids/boxes/search, in-memory import equivalence with the Python manifest, atomic manifest writes and portrait caching, game asset naming, type CSV parsing and cached file fetching). Browser checks open the storage system in demo, inject catalog, type and sprite fixtures, verify the game view requests the whole box once and stands in with PMD portraits, shows type badges and icons, selects a teammate through Guild team, switches to the guild view and verifies its portrait request excludes pack species, navigates by keyboard, opens Summary and Forms, chooses a shiny that is not yet imported, observes the import request and the resulting assignment, remembers the view, searches, changes boxes, pops the menu over the box, drives the fetch-all progress states and fits a 320 px panel. A real network run in a temporary pack built the catalog in under three seconds, imported Pikachu (Shiny), Arceus (Dragon) and Mr Mime (Altcolor) in about six seconds each with resolved contributor names, loaded the pack and fetched thirty box portraits in under three seconds with the cache serving the second pass. Live VS Code validation of the storage messages was not repeated beyond the existing extension test.

## 0.3.0: traversable maps, animated scenery and workspace auto-connect

Delivered 10 October 2026. The owner reported cramped movement and requested animated map alternatives, automatic connection and public visibility. The source repository is now public; original code licensing and separate local artwork handling are unchanged.

`src/navigation.ts` authors ground and obstacle polygons for Thunder Meadow and Transform Forest. The meadow replaces the oversized tree rectangle with a tighter silhouette and opens the lower clearing. An eight-pixel graph with sampled clearance on every edge finds routes around obstacles without diagonal corner cuts, then simplifies valid straight segments. Readers roam across the clearing; active workers alternate roughly 15 seconds of training with exploration, returning to their reserved station along a valid route. Slots remain stable within each map; map switches intentionally reposition actors at that map’s stations. Destination selection avoids nearby actors; full crowd collision avoidance is not implemented.

Transform Forest imports the existing 32-frame stone sheet with provenance from Toastypk and the Pamtre Berry mirror. It is a real animated layer over the map; JPEG mirror artefacts and chosen 120ms timing are disclosed. Thunder Meadow has original subtle breeze lines, not a fabricated claim of native weather-frame recovery. Both maps fit the canvas, with optional zoom/drag and an authored-walkable-area overlay. Quiet/reduced motion/hidden state stop simulation. Map choice persists in workspace state.

`src/autoconnect.ts` adds explicitly labelled workspace auto mode (default on). Supported recent workspace transcripts automatically become guild members and reconnect after reload. This is intentionally broader than proven native-window ownership: a folder match is eligibility within the chosen workspace scope, not proof of which chat window owns the session. Hash-only workspace leases refresh every four seconds, expire after 30 seconds and check process liveness. Overlapping root/child workspaces suspend automatic attachment at reconciliation; explicit manual and verified-window membership remain. Membership may take up to one heartbeat to reconcile after another window opens. Removed-session exclusions persist (bounded to 128); source events are never persisted. Unscoped hooks remain candidates. Transcript-derived workspace metadata can enable connection while stronger hook activity remains authoritative.

The Activity tab now has a provider/session picker and explains terminal-only events. New chats take the default selection unless the user has selected a teammate. The user clarified that Codex observation was already working; no speculative parser/API change was made. A fresh local probe observed two newly written Codex events with zero read errors.

Validation: 41 focused tests; actual browser pixel changes for the forest layer, greater-than-50-pixel patrol displacement, both maps, zoom/drag, reduced motion, Quiet, narrow layout and existing training/journal checks. An isolated real VS Code host automatically attached a synthetic supported transcript without Scan/Add and passed the existing terminal/webview checks. Two simultaneous lease records test same-folder and parent/child ambiguity; two interactive native-chat windows remain a manual coverage gap. Five labelled demo screenshots were refreshed. Assets remain outside Git and the VSIX.

## 0.2.0: Substitute training, Kanto roster and guided hook installation

Delivered 10 October 2026. Working, editing and shell-running states now train against the authentic Substitute sprite (`sprite/0000/0001`). Reading patrols and returns to its reserved station before attacking. Native Attack/Shoot timing alternates, with head-offset projectile origins, original element-coloured particles and Substitute Hurt frames. Attention, stale observation, Quiet, reduced motion and hidden panels stop training. Cycles are cosmetic, not tool counts, damage or completion signals. Older packs retain a procedural dummy fallback.

The local import now includes all nine Bulbasaur/Charmander/Squirtle line stages plus Eevee, Riolu and Ceruledge. `assets/roster.json` drives staged expansion. The importer preserves original PNGs, sprite/portrait credits, native timing, head/shadow offsets and 238 source receipts. The manifest is replaced only after a complete import. Runtime validation covers the optional Shoot and dummy sheets; existing default character assignments stay stable when the roster grows. Credits identify every imported contributor, including two unresolved upstream Discord credit IDs.

Connections now offers Connect Codex / Connect Claude, an in-panel settings destination and observer-only preview, and an explicit Install hooks button. It no longer opens an unexplained untitled JSON editor. The installer preserves other settings, writes an exact backup before changing configuration, refuses stale previews and repairs a missing observer helper on repeat installation. Codex trust stays with the user. Tests use temporary provider directories, never global provider configuration.

Historical Codex discovery rotates 16 older date directories per scan (up to 366 directories within the newest eight year directories), while checking the last three UTC dates each time. Previously watched logs stay watched outside the current batch; only recently modified, workspace-matching, supported records qualify. Connections reports scan progress. This improves resumed old threads without inferring window membership.

Validation: 36 focused tests, typecheck, production bundles, browser checks for generic-working impacts/projectiles, all nine starter selections, attention stops, hook installation controls, 320px layout, and the existing real VS Code terminal/webview integration. Four refreshed, labelled demo screenshots document the result. Live Claude native-chat, approval/subagent coverage and durable attachment restoration remain outstanding.

The repository was initially private; it became public in the 0.3.0 increment. Actions run 37970945659 could not start its job because of account billing/spending restrictions; local checks ran successfully. Billing was not changed.

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

Manual-only attachment is activation-local; workspace auto reconnection is described above: VS Code workspaceState can be shared by windows on the same folder, so restoring attachments from it risks cross-window binding. Reattach unbound chats after reload. Cosmetic character choices are saved per workspace/provider-session ID. Generic terminal identity lasts for the activation.

The store is capped at 128 sessions and bounded event/tombstone sets. Full process reconciliation and attachment restoration across extension reload remain future work. Some provider events lack turn IDs, limiting perfect ordering across turns. Child activity without a child ID cannot be assigned merely from timing. Agent/terminal grouping is explicit; no ownership is guessed from folder or timing.

Source navigation opens a terminal or the provider's panel. Exact native-chat conversation focus is not claimed. Hook installation is offered through the extension; trust is never silently granted.

## Native transcript fallback

`src/transcripts.ts` reads activity structure from local Codex/Claude JSONL files. Prompts, message text, tool arguments and outputs are discarded; paths are used locally for workspace filtering, and only the project basename is displayed. Nothing is uploaded. Disable `pmdAgents.observeLocalChats` to stop reading, then reload to clear retained session state.

Discovery checks the last three UTC Codex date directories, bounded batches of older folders (see 0.2.0 above), and each workspace's Claude project directory. It considers files modified within 12 hours, scans at most 64 recent candidates and tracks at most 16 matching sessions. Each initial read and polling read is capped at 1 MiB; partial history is labelled. Byte offsets remain stable across split UTF-8 reads; truncation resets parsing. Unsupported versions are skipped. Tested/inspected version families: Codex 0.153/0.159/0.162, Claude 2.1.289/2.1.292. These local formats are private and may change.

Native sessions initially arrive unbound; workspace auto mode can attach eligible records as described above. Directory equality does not establish native-window ownership. Non-startup hooks take priority; fresh transcript recovery after hook silence is described above. A missing hook with no newer evidence produces stale status, not fabricated completion. Transcript-only observation does not prove approval waits, child identities or exact-chat focus. Remote hosts require logs in that extension host's filesystem.

The sanitized `artifacts/transcript-probe.json` records 29 tool starts, 28 tool ends, one failure and one new turn from a local Codex VS Code session, including two events written during the probe. It contains no chat text or paths. Run `npx tsx scripts/probe-transcripts.ts <workspace-directory>` to repeat.

## Artwork

The importer pins SpriteCollab revision `47e5b9920bc5b2b491c53b18076300dc6813f103`, validates dimensions and directions, resolves aliases, and reads white shadow anchors. [PMD Sprite Format](https://wiki.pmdo.pmdcollab.org/PMD_Sprite_Format) defines durations in 1/60-second units. Source PNGs are unchanged.

Ignored `assets/local` contains the pack, source records, original credit files and SHA-256 receipts. Python and Pillow are required to import it. Maps and the font are downloaded from pinned public sources and verified by hash. The map's exact original ripper remains unresolved.

Eevee and Riolu sprite records identify CHUNSOFT with Unspecified licence markers. Ceruledge identifies baronessfaron with historical terms. Portrait records also name Fearless-Quit and Top_Kec. The repository's general CC BY-NC notice is not a claim that every original game sprite is licensed fan art. Artwork is excluded from Git and the VSIX.

The tree silhouette is blocked using authored geometry; no foreground mask is fabricated. Training dummies use imported Substitute Idle/Hurt sheets; older packs fall back to an original procedural prop. Move particles are original decorative effects. Six positions appear per clearing page; all sessions remain in the roster. Bounded grid routing is implemented. Map editing, NPC sparring and dungeon expeditions are not implemented.

## Validation

- TypeScript typecheck and production bundles.
- Forty-one focused tests cover state ordering, attention, redaction, source recovery, window membership/linking, bounded journal history, stable placement, native transcript parsing, asset integrity and local transport.
- Playwright: demo isolation, roster, credits, paused simulation and 320px layout; desktop and narrow screenshots visually inspected.
- Real VS Code: terminal lifecycle, shell command, webview ready and unbound hook candidate.
- Actual CLI startup probes described above.

Screenshots, probe state and logs stay in ignored `artifacts`. No paid service, global provider setting or file outside this project was changed by these tests.

## Next increment

Exercise live native Claude chat and both clients after hook setup/trust, including approval/input and child agents. Establish durable window identity for attachment restoration and improve process reconciliation before expanding maps.

## 0.4.3: workspace discovery diagnostics

A live sanitized probe saw Codex generation/tool events for the chat project, while the sole guild lease watched a different sibling project. No folder was hardcoded; the empty guild hid the mismatch. Snapshots now include current workspace display names, bounded scans count recent supported files outside that scope without exposing their paths, and the empty state explains the actionable cause. Add project folder delegates to VS Code's folder picker. Regression coverage uses random temporary project roots, separate instances and a workspace switch; no cross-workspace events are attached. Known format/version gates remain unchanged.


## 0.4.5: eleven native Friend Areas

The scenery importer decodes pinned Red Rescue Team BPC/BMA/BPL data into local
backgrounds and transparent palette-bank strips. Native integer tick durations
replace the guessed stone timing and authored meadow breeze. Nine maps animate;
Mushroom Forest and Rainbow Peak contain no native palette/tile cycles.
`npm run import:scenery -- --output <pack>` updates only maps and receipts,
preserving imported species. New installs include all eleven areas.

Navigation accepts a union of floor polygons; each map has six reachable work
stations whose training targets also lie on safe floor. Stable meadow/forest ids
and legacy millisecond layers remain supported. Quiet/reduced-motion and hidden
view scheduling still govern animation, independently of observed agent status.
Sources, derived maps and animation strips remain excluded from Git and VSIX.

Validation: 63 TypeScript tests, three decoder fixtures, typecheck/build, and
browser checks for every map's actual animated pixels without agents, Quiet,
reduced motion, training routes, storage, session placement and narrow layout.


## 0.5.0: Explorer widget and Windows desktop companion

A `WebviewViewProvider` contributes a default-visible Explorer guild. The full
editor guild remains available. Both use the existing renderer/session snapshot;
compact mode keeps the map, Friend Area selector, Quiet and Open guild controls.
Map/Quiet preferences broadcast across all surfaces and persist per workspace.
View message handlers are disposed on remount; delayed asset reads cannot revive
views or helpers after disposal.

A Windows x64 WinForms helper hosts the same renderer in the installed WebView2
runtime. It is built from `src/native/PmdWidget.cs`, with a hash-pinned SDK. The
extension starts one hidden helper per local window via inherited JSON pipes;
there is no desktop HTTP/control listener. An activation-unique accessibility
label on the PMD status-bar item identifies the owner among windows of the same
VS Code executable. Win32 window properties and process identity guard against
handle reuse. No folder/title matching and no change to provider session scope.
The status item must be visible for initial matching; an unmatched helper still
supports manual pop-out and retries matching. Once bound, the label is normal.

`IsIconic` drives automatic pop-out, not the VS Code focus/active flags. The form
is resizable, always on top, and automatically shows without taking focus. Its
own minimize/close dismisses it until manual show or the next owner minimize
cycle. Owner restoration hides it; owner close or pipe EOF shuts it down. Tray
controls recover a dismissed widget. Bounds are clamped to an available monitor.
Unique WebView2 cache folders are removed on child close. The setting can stop and
restart the helper without affecting observation or the sidebar.

Virtual HTTPS origins map only packaged UI and the configured artwork pack;
external requests, navigation, downloads, popups and permissions are blocked.
Only ready, scene, quiet and open-guild messages cross from the native view.
Missing native/runtime support leaves the sidebar available. Non-Windows,
non-x64 and remote hosts skip the helper; trust restrictions remain unchanged.

Validation includes 63 source tests, typecheck/build, existing full-guild browser
regressions, compact 260x240 layout/live-feed/motion/control checks, real VS Code
Explorer resolution and native ownership binding, two independent native owner
windows with minimize/dismiss/restore/close checks, actual WebView2 artwork loads,
and packaged-helper startup/pipe-EOF cleanup. Screenshots and test profiles stay
under ignored artifacts. Artwork remains outside Git and the VSIX.

## 0.5.1: release preparation (12 October 2026)

The README now leads with installation, supported-platform limits and the
separate artwork requirement. SETUP.md covers missing assets, default local
observation, optional hooks, updates, disabling and uninstalling. Original code
has a proprietary installation/use licence; third-party rights remain separate.

Packaging derives its version from package.json, rejects files outside a fixed
16-file allowlist, compares shipped code/native/licence bytes to the build and
writes a SHA-256 checksum only after verification. The package-install harness
uses the installed VS Code CLI wrapper (including versioned installations), an
isolated profile and extension directory, synthetic provider records and an
explicitly empty artwork folder. It loads the installed VSIX's extension bytes
in the VS Code test host; source test code stays outside the VSIX.

Validation: typecheck and 63 source tests passed. A fresh-profile VSIX install
passed Explorer/full-guild initialization, native ownership binding, synthetic
Codex auto-attachment, real terminal shell events and overlapping-lease recovery
without inheriting the developer's artwork. This does not validate a new user's
rights to download artwork, a fresh upstream artwork import, live Claude, or
remote/non-Windows hosts. Existing 0.5.0 runtime/UI coverage remains applicable;
the application runtime source is unchanged.

After the risk discussion, the owner explicitly authorised the GitHub release
on 12 October 2026. Version 0.5.1 publishes the VSIX and checksum with installation
instructions and support limits. Publication does not establish artwork clearance.

## 0.5.2: fresh windows, connections and training (12 October 2026)

The previous fresh-profile test explicitly opened the sidebar. Removing that
action reproduced a startup failure: activation alone did not reveal the widget.
Startup now reveals the Explorer view with preserved keyboard focus; the default
`autoShowWidget` setting can be disabled. The integration test waits for natural
activation and view initialization without calling Activate or Show Widget.

Claude 2.1.77, 2.1.295 and 2.1.296 were rejected by the old version allowlist.
Their actual record schemas were inspected before adding support. Live no-tool
turns on installed standalone CLI 2.1.77 and the VS Code bundled 2.1.296 executable
each produced turn, pulse and finish events with no read errors. Native VS Code
2.1.295/2.1.296 tool records were replayed, and native Codex
0.162.0-alpha.17.2 supplied live events. Running the bundled Claude executable is
CLI evidence, not an end-to-end test of its native chat UI. Live native approval
and child flows remain unverified.

Hooks gain workspace membership when matching transcript metadata arrives,
without replacing hook activity with stale replay. Direct hook startup retains
window membership. Automatic attachment still retries continuously; exclusions,
overlap and unavailable observation now have specific candidate explanations.
No folder equality is presented as proof of native-window ownership.

Both importers now include available Strike, QuickStrike, MultiStrike and
SpAttack alongside Attack/Shoot. Training rotates unique source sheets with
their native durations, anchors and hit frames. CopyOf aliases share a move.
After travel or attention the attack restarts at the beginning. Quiet/reduced
motion still stop training. The local upgrade command preserves the roster and
maps, validates every sheet and records pinned source receipts. Existing packs
without optional combat sheets still work.

Validation: 67 source tests, typecheck, browser regressions, compact widget
checks and native QuickStrike/MultiStrike/SpAttack canvas checks passed. The
packaged VSIX passed automatic startup, synthetic Codex/Claude attachment and
streaming, real terminal lifecycle/shell events, native window binding and
lease-failure recovery in a fresh profile with no inherited artwork. The shared
22-species local pack was upgraded and validated; artwork remains excluded from
the VSIX and Git. Native minimize/restore code is unchanged from the 0.5.0 audit.
