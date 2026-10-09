# PMD Agents

A local Pokémon Mystery Dungeon guild for coding agents in VS Code.

**Development build 0.1.2 — 10 October 2026.** Real VS Code terminal tracking and live Codex native transcript observation are tested. Claude CLI startup and historical native-chat records are verified; live Claude chat tracking still needs a check.

## Try it

The local build is installed. In VS Code, press **Ctrl+Shift+P**, run **Developer: Reload Window**, then **PMD Agents: Open Guild**. To install on another local profile, use **Extensions: Install from VSIX** and choose `artifacts/pmd-agents-0.1.2.vsix`; import/select the local artwork pack separately.

- Team shows terminal jobs and attached provider sessions.
- Activity shows the selected session's last 32 accepted observations, their time and source. Recently closed sessions remain available there. This journal contains event categories only and lasts for the extension activation.
- Teammates keep their map positions when other sessions join, leave or link. Attention rises to the top of the roster without reshuffling the map; occupied clearings remain reachable as the team shrinks.
- Connections lists recent workspace chats from supported local client versions. Attach the intended chat; transcript observation is labelled and may be partial. Disable it with `pmdAgents.observeLocalChats`.
- Connections → Set up observer hooks previews Codex/Claude configuration, preserves existing hooks and backs up changes. Codex requires its own `/hooks` trust review.
- Native chats without a window token appear as candidates. Attach the intended session explicitly; reattach after reloading the extension.
- Connections → Manage guild lets you link a terminal-launched agent to its terminal, or remove a session from the guild without stopping it. Native Codex/Claude panel chats should stay separate from unrelated terminals.
- Working sessions patrol; observed editing attacks a dummy. Thinking/output record metadata refreshes activity without retaining its text. Quiet, reduced motion, approval, stale or unavailable observation stop patrols.
- Connections → Scan for chats refreshes discovery and shows counts for watched files, unsupported records and read errors. Local discovery normally considers the last 12 hours.
- Try demo is a clearly labelled visual replay. Quiet pauses movement without hiding status.

Artwork is a separate local pack, excluded from the VSIX. The extension looks in development `assets/local`, then `~/.pmd-agents/assets`. Connections → Choose asset pack accepts the directory containing the generated manifest.

## Build

Requires Node.js 22+, npm and VS Code 1.109+. Asset import also needs Python 3 and Pillow.

```powershell
npm ci
python -m pip install Pillow
npm run import:assets
npm run typecheck
npm run build
npm test
npm run preview
```

The importer reads the map/font from sibling Voracity without changing it and downloads pinned sprite sources. For another location: `python scripts/import-assets.py --voracity "path/to/voracity"`.

The preview runs at http://127.0.0.1:5188. It starts empty; select Try demo. It is not a live browser monitor.

```powershell
npx playwright install chromium
npm run test:browser
npm run test:extension
npm run package
```

The browser test starts and stops its own preview server on a free local port. The VS Code test uses an isolated profile; set `PMD_VSCODE_EXECUTABLE` for another installation. Neither submits model prompts. Startup-only probes: `npx tsx scripts/probe-clients.ts`.

## Documents

Read `docs/IMPLEMENTATION.md` for actual evidence and gaps, `docs/PLAN.md` for the roadmap, `docs/RESEARCH.md` for the archive/source review, and `docs/ATTRIBUTION.md` for asset terms.

The predecessor, [The Office](https://github.com/kevanwee/theoffice), was archived on GitHub at the owner's request. This is a separate project; Voracity supplies visual references and candidate assets.

Inspired by [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents), by Pablo De Lucca and contributors. This implementation does not copy its source code.

Local sprite and portrait credit records include CHUNSOFT, baronessfaron, Fearless-Quit and Top_Kec. Original game sprites and historical fan-art terms are distinguished in the local manifest. Pixelify Sans is by the Pixelify Sans Project Authors under SIL OFL. Thunder Meadow is a local Voracity game-map reference; its original ripper is not verified.

PMD Agents is intended as a non-commercial fan project, unaffiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company, or Spike Chunsoft. Pokémon and Pokémon Mystery Dungeon names, characters, and game artwork belong to their respective owners. Individual third-party assets retain their own terms; this notice does not grant permission to redistribute them.
