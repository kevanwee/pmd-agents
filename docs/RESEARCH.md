# Source review and archive receipt

Reviewed 9 October 2026. These are source observations, not a reproduced end-to-end diagnosis of the installed extension.

## Archive completed

- Repository: https://github.com/kevanwee/theoffice
- GitHub reports `isArchived: true`, verified after the archive operation.
- Default branch: `main`; inspected commit: `6630c1f9541ed1be05b792ceff75098e6226d16e`.
- A fresh local reference checkout is in the sibling `theoffice` directory (`../../theoffice` from this document).
- Git history remains in the repository. No branches, source assets, installed extension, or `~/.the-office` settings were deleted.
- The installed `kevanwee.theoffice-0.1.0` extension remains installed. Archiving a repository does not disable installed software. Replacing/disabling it belongs to the eventual PMD Agents installation step.
- This is a normal reference clone, not a certified offline backup of all hosted issues, releases or LFS assets.

## Why the previous design is a poor base

| Finding at the inspected commit | Evidence | Consequence for PMD Agents |
| --- | --- | --- |
| Work is still represented by seats and typing | `webview-ui/src/office/engine/characters.ts`; `renderer.ts:140` applies a sitting offset for TYPE | Replace seat allocation with activity zones; do not retain an office simulation under a map |
| The active renderer assumes four equal square columns and direction rows | `renderer.ts:160–175` derives frame size from image width divided by four | Parse each PMD animation's dimensions, durations, facings and offsets; do not impose a universal sheet grid |
| A second sprite renderer uses bob/scale/rotation transforms | `office/sprites/pokemonSpriteRenderer.ts` | This module is not imported by the active renderer in the inspected tree. Treat it as architectural residue, not proof of the current visual bug |
| Copilot observation depends on dynamically probed APIs | `src/agentAdapters/CopilotAdapter.ts:122`, `:182`; the current stable VS Code API reference does not list `onDidReceiveChatRequest` | Do not promise universal chat interception based on guessed APIs |
| That adapter synthesizes completion after 800 ms | `CopilotAdapter.ts:159–169` | Tool completion must have supporting evidence; a timer may mark stale data, never successful work |
| Codex correlation uses launch time and working directory | `src/agentAdapters/CodexAdapter.ts:63–95` | It deliberately refuses ambiguous simultaneous launches. Retain the refusal to guess; replace the limitation with explicit session/window binding |
| Documentation still describes older Pixel Agents identifiers and architecture | `CLAUDE.md` vs current package and source | Keep one accurate architecture guide and evidence-backed support matrix |

The existing Codex ambiguity guard and parser tests are useful references. This is not a recommendation to throw away every lesson or helper; it is a recommendation for a clean product/state model.

## Upstream reference

[Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) now separates providers, runtime, host adapters and Canvas rendering. Its documented implemented provider is Claude Code; its roadmap should not be mistaken for verified Codex support. Use it as a reference for character/session identity, activity cues, local transports, layout persistence and subagent presentation. Avoid importing its office-specific seats and furniture assumptions.

[Its MIT licence](https://github.com/pixel-agents-hq/pixel-agents/blob/main/LICENSE) identifies Pablo De Lucca. Preserve the full notice for any reused code and record the exact imported revision. The Office's own licence names Kevan Wee; that does not replace upstream notices for upstream-derived code.

## Integration evidence

- [Codex hooks](https://learn.chatgpt.com/docs/hooks): lifecycle, tool, permission and subagent events are documented; hooks require trust review. Transcript formats are explicitly unstable, and some tool paths are outside hook coverage. This supports a hook-first design, subject to testing each installed client. It does not establish a public cross-extension chat-monitoring API.
- [Codex App Server](https://learn.chatgpt.com/docs/app-server): offers thread/turn/item events for connected clients. Reserve it for sessions PMD Agents intentionally hosts later; starting another server is not evidence that an existing IDE session is observable.
- [Claude Code hooks](https://code.claude.com/docs/en/hooks): documented lifecycle and tool events provide the first Claude integration candidate. Client/version differences exist, including permission notifications in IDE-hosted sessions; test CLI and extension separately.
- [VS Code terminal APIs](https://code.visualstudio.com/api/references/vscode-api#TerminalShellIntegration): shell execution start/end and associated output streams exist where shell integration is available. They do not reveal the internal reasoning or child-agent structure of arbitrary commands. Output reading is not retroactive.

Local inventory, without changing configuration:

| Component | Observed |
| --- | --- |
| Codex CLI | `0.153.4` |
| Claude Code CLI | `2.1.77` |
| Claude VS Code extension directory | `anthropic.claude-code-2.1.292-win32-x64` |
| OpenAI VS Code extension directories | `26.51002.51308` and `26.51007.21434` |
| The Office extension directory | `kevanwee.theoffice-0.1.0` |

Directory presence does not prove which version is active or that hooks work. In particular, the Claude CLI and extension differ substantially. No private chats or credential files were inspected. Runtime compatibility remains a Phase 0 deliverable.

## Scene references

| Material | What it establishes |
| --- | --- |
| Transform Forest ([Pamtre Berry mirror](https://pamtre-berry.neocities.org/articles/friendareas), ripper Toastypk) | Native 480 × 312 coordinates, a narrow clearing and a central stone exclusion; paths rather than unconstrained wandering |
| Thunder Meadow (same mirror) | 456 × 335 map, walkable plateau and central tree obstacle; visually inspected |
| PMD SpriteCollab `AnimData.xml` | Variable frame dimensions/durations, animation aliases, attack rush/hit/return frame indices |

Preserve native artwork and coordinate systems. Public availability is not proof of redistribution permission.


## Native map animation, 11 October 2026

[pret/pmd-red](https://github.com/pret/pmd-red/tree/013475aa04f5be3191e5527c186d9bfceae7cae0)
contains the original map tiles, map row compression and palettes. At this pinned
revision, `src/ground_bg.c` defines the BPC/BMA decoder and BPL palette player;
`src/bg_palette_buffer.c` converts RGB bytes to GBA RGB555. The eleven chosen
Friend Areas have no BPA tile-animation slots. Nine use native BPL cycles;
Mushroom Forest and Rainbow Peak do not. This replaces the earlier unverified
scenery status and guessed 120 ms stone timing (native is six ticks / 100 ms).


## Persistent widget research (11 October 2026)

- [VS Code webview views](https://code.visualstudio.com/api/extension-guides/webview) support an Explorer-hosted `WebviewViewProvider`. VS Code ignores `initialSize` for views in containers owned by another extension; users resize/reorder the view normally.
- [`WindowState`](https://code.visualstudio.com/api/references/vscode-api#WindowState) exposes focus/activity, not native minimization. Losing focus must not trigger pop-out.
- [Win32 IsIconic](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-isiconic) reports native minimized state. Ownership is verified first by an activation-unique accessible status label and the executable path, then tracked with an HWND property/PID.
- [WebView2 distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution) distinguishes the SDK from the installed runtime. We reuse the installed Evergreen Runtime and include SDK redistributables, not a downloaded browser runtime.
- [Virtual-host mappings](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.setvirtualhostnametofoldermapping) serve packaged UI/local assets without starting an HTTP server. Asset-origin CORS allows fonts; page CSP and request/navigation handlers restrict destinations.
- Initial Windows integration demonstrated that foreground-only discovery misses background/new windows. Enumerating same-executable windows and requiring the exact random accessibility marker resolved real VS Code binding without focus stealing or title heuristics.
