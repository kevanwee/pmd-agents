# PMD Agents

A local Pokémon Mystery Dungeon guild for coding agents in VS Code.

**Development build 0.1.0 — 9 October 2026.** Real VS Code terminal tracking and live Codex native transcript observation are tested. Claude CLI startup emitted a hook event; native Claude chat tracking still needs a live check.

## Try it

Install `artifacts/pmd-agents-0.1.0.vsix` and run **PMD Agents: Open Guild** from the Command Palette.

- Team shows terminal jobs and attached provider sessions.
- Connections lists recent workspace chats from supported local client versions. Attach the intended chat; transcript observation is labelled and may be partial. Disable it with `pmdAgents.observeLocalChats`.
- Connections → Set up observer hooks previews Codex/Claude configuration, preserves existing hooks and backs up changes. Codex requires its own `/hooks` trust review.
- Native chats without a window token appear as candidates. Attach the intended session explicitly; reattach after reloading the extension.
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

The browser test expects the preview server. The VS Code test uses an isolated profile; set `PMD_VSCODE_EXECUTABLE` for another installation. Neither submits model prompts. Startup-only probes: `npx tsx scripts/probe-clients.ts`.

## Documents

Read `docs/IMPLEMENTATION.md` for actual evidence and gaps, `docs/PLAN.md` for the roadmap, `docs/RESEARCH.md` for the archive/source review, and `docs/ATTRIBUTION.md` for asset terms.

The predecessor, [The Office](https://github.com/kevanwee/theoffice), was archived on GitHub at the owner's request. This is a separate project; Voracity supplies visual references and candidate assets.

Inspired by [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents), by Pablo De Lucca and contributors. This implementation does not copy its source code.

Local sprite and portrait credit records include CHUNSOFT, baronessfaron, Fearless-Quit and Top_Kec. Original game sprites and historical fan-art terms are distinguished in the local manifest. Pixelify Sans is by the Pixelify Sans Project Authors under SIL OFL. Thunder Meadow is a local Voracity game-map reference; its original ripper is not verified.

PMD Agents is intended as a non-commercial fan project, unaffiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company, or Spike Chunsoft. Pokémon and Pokémon Mystery Dungeon names, characters, and game artwork belong to their respective owners. Individual third-party assets retain their own terms; this notice does not grant permission to redistribute them.
