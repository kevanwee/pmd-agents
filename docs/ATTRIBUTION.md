# Attribution and asset handling

This is a release plan and draft notice, not an asset clearance certificate. The implementation imports an ignored local artwork pack; game artwork is excluded from Git and the VSIX. Current findings and named contributors are in [IMPLEMENTATION.md](IMPLEMENTATION.md).

The owner requested GitHub publication with screenshots on 10 October 2026. Curated screenshots in `docs/screenshots` show labelled demo sessions and contain rendered third-party artwork; they retain the credits below. Source artwork files remain excluded. Private session screenshots and probe exports remain in ignored `artifacts`.

## Draft visible notice

> PMD Agents is a non-commercial Pokémon Mystery Dungeon fan project. It is not affiliated with, endorsed by, or sponsored by Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company, or Spike Chunsoft. Pokémon and Pokémon Mystery Dungeon names, characters, and game artwork belong to their respective owners.

Place a short “Unofficial fan project · Credits” link in the panel's About area, with the full notice in Credits, README and extension listing. Do not interrupt normal agent use with a repeating disclaimer dialog.

## Credits to retain

| Material | Credit and release treatment |
| --- | --- |
| Inspiration and any imported Pixel Agents code | Pablo De Lucca and Pixel Agents contributors; link the repository. For code reuse, retain the complete upstream MIT notice and imported revision |
| Owner's previous work | Kevan Wee; identify The Office as predecessor |
| PMD SpriteCollab sprites and portraits | Name individual contributors from each selected sprite/portrait's credit records; link the exact source and [repository](https://github.com/PMDCollab/SpriteCollab). Record applicable licence/history at the pinned revision |
| SpriteCollab licence | Current repository publishes [CC BY-NC 4.0](https://github.com/PMDCollab/SpriteCollab/blob/master/LICENSE.md). Preserve attribution, licence link and modification notes. This does not license underlying Pokémon IP or unrelated map rips |
| Transform Forest, if imported | Original ripper **Toastypk**, [Spriters Resource listing](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/5395/), [Pamtre Berry mirror](https://pamtre-berry.neocities.org/articles/friendareas), game rights holders; retain the original source receipt |
| Thunder Meadow, if imported | Game title and rights holders, [Pamtre Berry mirror](https://pamtre-berry.neocities.org/articles/friendareas) source file and any supplied ripper credit; the original ripper is unverified, so complete the file-level record before release |
| Additional PMD maps/tiles/UI | Exact game, source file and page, ripper or artist, modifications and usage basis. Do not attribute all maps to SpriteCollab |
| Pixelify Sans, if bundled | Font authors and included SIL Open Font License; include the actual notice alongside the font |
| Libraries | Generate third-party notices from actual pinned dependencies, not a speculative list |

Do not credit weather providers, soundtrack sources, Mega symbol artists, or office furniture packs unless their material is actually used. Music is absent from the first release.

## Required asset manifest

Each file or inseparable asset group needs: stable asset ID; category; species/form/action or map name; source URL and revision; upstream file path; SHA-256; named contributors and credit-record source; licence and notice path; changes made; original dimensions; importer version; and a distribution status (`reviewed-for-bundle`, `local-reference-only`, `unresolved`). Record who made the distribution decision and its basis; the build checks completeness, not legal conclusions.

Game maps found on a wiki or rip archive are not automatically licensed for redistribution. The first map study can reference the user's existing local files. A public package includes only assets with a documented basis; unresolved originals remain in an excluded local pack. If necessary, commission/create compatible original environment artwork or provide a local import route. A local import route is not a claim that all uses are legally permitted.

Keep source code, fan sprites, game rips, fonts and other dependencies distinct in notices. The new code's release licence is not selected by this planning task. Do not copy The Office's blanket MIT badge onto the new package.

Acceptance: every bundled asset resolves to a provenance record; selected Pokémon expose their individual credits; release packaging rejects unresolved artwork; README and in-app Credits describe the same shipped material. Original/repacked/recoloured assets must be described accurately.


## Expanded local pack, 0.2.0

The catalog now includes Bulbasaur, Ivysaur, Venusaur, Charmander, Charmeleon, Charizard, Squirtle, Wartortle and Blastoise, alongside the original three. Substitute is imported from `sprite/0000/0001` at the same pinned revision; its records name CHUNSOFT and JFain. The original sheets are unchanged. Canvas projectile and impact particles are original code-generated visuals, not ripped move-effect sheets. Exact per-asset sources, contributor records and hashes remain in the local manifest; the in-guild Credits view includes the expanded roster and dummy. README lists all resolved contributor names and preserves the two upstream Discord-only identifiers.


## Storage-system imports, 0.4.0

The storage system fetches box portraits (`portrait/<form>/Normal.png`) and chosen sprite sets from the same pinned SpriteCollab revision as the Python importer, into the ignored local pack only. Every fetched file gets a receipt (source URL, SHA-256, unmodified) in `manifest.json` or `dex/portraits.json`; sprite and portrait `credits.txt` records are stored under `sources/` and resolved through `spritebot_credits.txt` into the species entry, so the in-guild Credits view names each imported form's contributors. The catalog (`dex.json`) is derived from `tracker.json` and lists names, completion phases and primary credits; it contains no artwork. Fetched artwork remains excluded from Git and the VSIX, and no fetched file is redistributed. The storage view's frame, slots and menu are original CSS, not game UI rips.

Since 0.4.4 the game view's box icons come from the [Smogon / Pokémon Showdown sprite repository](https://github.com/smogon/sprites) at revision `bad55c7b7e7292f459366505460d41dcab08d4cd` (`src/minisprites/pokemon/gen6/`, indexed in `src/smogon-icons.json`): Gen 6/7 menu sprites for every species, with Generation VIII and IX icons drawn by the Smogon community in that style (files marked `-vsmogon`). One set keeps every box icon on the same canvas and scale; Generation VIII icons stopped at Calyrex, so later species previously showed resized front sprites. The repository publishes no licence; the icons are fan and game artwork kept in the local pack only, each with a receipt. Before 0.4.4 the box icons (`sprites/pokemon/versions/generation-viii/icons/`) came from PokeAPI. The front sprites (`sprites/pokemon/`) and shiny fronts (`sprites/pokemon/shiny/`) are main-series game artwork belonging to Nintendo, Creatures Inc. and GAME FREAK, obtained through the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites) at revision `35fdbe9bdec8f519f882c3edc3c0185f08af4d86`; type data comes from [PokeAPI](https://github.com/PokeAPI/pokeapi) CSVs at `c80757193bd0889054e36f4209762360bdaa4b95` under BSD-3-Clause. Each fetched file is recorded in `game/receipts.json` with its source URL and SHA-256, marked `local-reference-only`; `game/types.json` records its revision and licence. The repository's availability of these rips is not treated as a redistribution licence: the files stay in the ignored local pack and the VSIX, and the wallpaper, type badges and bar are original CSS rather than captured game UI. Committed screenshots that show these sprites retain this attribution.

## Animated scenery and public source, 0.3.0

The owner authorized public repository visibility on 10 October 2026. Source artwork remains excluded from Git and VSIX; curated demo screenshots remain attributed. Transform Forest imports the mirror's unmodified background and crops its 32-pose stone sheet, with source receipts. Original ripper: Toastypk. Mirror: [Pamtre Berry / Taliax](https://pamtre-berry.neocities.org/articles/friendareas). The mirror’s stone poses are JPEG-derived; the importer preserves that limitation and does not call them lossless. Playback at 120ms per pose is this project’s chosen timing because original timing was not supplied. Thunder Meadow breeze lines and navigation polygons are original implementation work, not ripped game weather or collision data.
