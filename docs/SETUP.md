# Installation and troubleshooting

Download the VSIX and matching checksum from
[GitHub Releases](https://github.com/kevanwee/pmd-agents/releases).
The README provides the current release's direct download links.

## Requirements

The packaged desktop companion targets local Windows x64. Use VS Code 1.109 or
newer and the Microsoft Edge WebView2 Runtime. The sidebar implementation is
cross-platform, but macOS, Linux, Windows ARM, WSL, SSH and containers have not
passed release validation. No Node.js or Python installation is needed to run
the VSIX. Importing the starter artwork from a source checkout needs Python 3
and Pillow; building the extension needs Node.js 22+, npm and Windows tooling.

## First run and artwork

Install from VSIX and reload the window. PMD Agents reveals its Explorer widget
automatically in each trusted window without taking keyboard focus. To opt out,
set `pmdAgents.autoShowWidget` to `false`. If hidden,
run **PMD Agents: Show Sidebar Widget**. The full guild's Connections page lets
you choose a local pack directory containing `manifest.json`. Use an absolute
path. Development builds otherwise look in `assets/local`; installed builds
fall back to `~/.pmd-agents/assets`. The `pmdAgents.assetPath` setting overrides
both, so a stale configured path can hide an otherwise valid pack.

An empty installation can observe sessions but cannot draw the PMD scene. The
VSIX does not install artwork. Use only material for which you have permission
or another applicable legal basis. The existing importers record sources and
credits; those records are not permission. See [attribution](ATTRIBUTION.md).

For an existing compatible pack, choose its folder in Connections. After editing
`pmdAgents.assetPath` directly in Settings, reload the window. Keep the pack
outside the installed extension directory so upgrading the extension does not
replace it. Do not attach your pack, transcripts or full VS Code logs to issues.

To add the expanded attack animations to an existing pack, run
`npm run import:training -- --output "C:/path/to/your/pack"` from a source checkout
with Node.js and dependencies installed, then reload the window. This preserves
the roster, maps and session assignments. The command downloads available native
combat sheets from the pinned source; a failure leaves completed species usable
and can be retried. Attack-only packs remain compatible.

## Connections and privacy

Local transcript observation is **on by default** in trusted workspaces. It reads
recent supported Codex/Claude records to derive activity metadata. Prompts,
outputs and tool arguments are discarded before the view and activity journal;
they are not uploaded by PMD Agents. Session preferences persist locally.
Workspace matching is not proof of a native chat's window ownership. Automatic
attachment pauses when another guild window watches overlapping folders.

To opt out before using a workspace, set `pmdAgents.observeLocalChats` to `false`
in the profile's settings before enabling the extension. `autoConnect` and
`autoAttach` govern membership, not whether the transcript reader runs. Hooks
and terminal events are separate sources. Hook setup is optional, writes only
after its Install action, preserves unrelated configuration and makes backups.
The local receiver authenticates hook requests; it is not a hosted service.

Opening the PC or importing artwork can contact the pinned upstream GitHub
sources for catalogs, sprites, portraits and type data. Those hosts receive
normal download request metadata. Local observation makes no additional model
calls. Agent providers retain their own privacy terms and usage costs.

## Common problems

| Symptom | Check |
| --- | --- |
| Widget absent | Install in the current VS Code profile, trust the workspace, reload, then Show Sidebar Widget |
| Empty scene | Choose a complete pack; check `pmdAgents.assetPath` and the reported asset error |
| No agent appears | Open the chat's project folder; inspect Connections and Activity; check observer settings and overlapping windows |
| Wrong chat expected | Workspace auto mode does not prove exact-window identity; use explicit attachments and exclusions |
| Claude status missing | Upgrade PMD for supported formats (2.1.77, 2.1.289, 2.1.292, 2.1.295, 2.1.296). Live CLI turns pass; native chat UI coverage remains incomplete |
| Attach button still shown | Read the reason on the card. Automatic connection retries after an overlap or registry problem clears. Deliberately removed sessions stay excluded until attached again |
| Desktop widget absent | Check local Windows x64, WebView2 Runtime and `pmdAgents.desktopWidget`; keep the status bar visible for initial owner binding; try Show Desktop Widget |
| Widget disappeared after minimizing it | Restore it from its tray menu, or restore and minimize its owning VS Code window |
| Old UI after update | Reload every already-open VS Code window |

The desktop helper is currently unsigned. Verify the release source and checksum;
do not disable system security protections to run an unexpected binary. A checksum
checks the downloaded bytes against the published value; it is not a publisher
signature or a legal clearance statement.

## Update, disable and uninstall

Install the newer VSIX in each desired profile, then reload each open window.
GitHub VSIX downloads do not provide a Marketplace auto-update channel. Keep your
pack and settings. To roll back, install a retained earlier official VSIX and
reload; settings compatibility across future versions is not guaranteed.

For sidebar-only use, turn off `pmdAgents.desktopWidget`. To stop the extension,
disable it in VS Code. Before uninstalling, run **PMD Agents: Remove Provider
Hooks** if you installed its hooks. Then uninstall through Extensions and reload
the window. Closing the extension's window stops its companion. Uninstalling does
not delete your separate pack or provider configuration backups. Remove those
manually only if you no longer need them; they may be shared by other profiles.
