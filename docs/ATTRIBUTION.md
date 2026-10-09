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
| Owner's previous work | Kevan Wee; identify The Office as predecessor and Voracity as the visual/asset-pipeline reference. Do not relicense Voracity's all-rights-reserved source merely because the owner also owns this project |
| PMD SpriteCollab sprites and portraits | Name individual contributors from each selected sprite/portrait's credit records; link the exact source and [repository](https://github.com/PMDCollab/SpriteCollab). Record applicable licence/history at the pinned revision |
| SpriteCollab licence | Current repository publishes [CC BY-NC 4.0](https://github.com/PMDCollab/SpriteCollab/blob/master/LICENSE.md). Preserve attribution, licence link and modification notes. This does not license underlying Pokémon IP or unrelated map rips |
| Transform Forest, if imported | Original ripper **Toastypk**, [Spriters Resource listing](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/5395/), [Pamtre Berry mirror](https://pamtre-berry.neocities.org/articles/friendareas), game rights holders; retain the original source receipt |
| Thunder Meadow, if imported | Game title and rights holders, exact source page/file and any supplied ripper credit. Voracity's generic Mystery Dungeon Wiki credit is a starting point; complete the file-level record before release |
| Additional PMD maps/tiles/UI | Exact game, source file and page, ripper or artist, modifications and usage basis. Do not attribute all maps to SpriteCollab |
| Pixelify Sans, if bundled | Font authors and included SIL Open Font License; include the actual notice alongside the font |
| Libraries | Generate third-party notices from actual pinned dependencies, not a speculative list |

Do not credit weather providers, soundtrack sources, Mega symbol artists, or office furniture packs unless their material is actually used. Music is absent from the first release.

## Required asset manifest

Each file or inseparable asset group needs: stable asset ID; category; species/form/action or map name; source URL and revision; upstream file path; SHA-256; named contributors and credit-record source; licence and notice path; changes made; original dimensions; importer version; and a distribution status (`reviewed-for-bundle`, `local-reference-only`, `unresolved`). Record who made the distribution decision and its basis; the build checks completeness, not legal conclusions.

Game maps found on a wiki or rip archive are not automatically licensed for redistribution. The first map study can reference the user's existing local files. A public package includes only assets with a documented basis; unresolved originals remain in an excluded local pack. If necessary, commission/create compatible original environment artwork or provide a local import route. A local import route is not a claim that all uses are legally permitted.

Keep source code, fan sprites, game rips, fonts and other dependencies distinct in notices. The new code's release licence is not selected by this planning task. Do not copy The Office's blanket MIT badge onto the new package.

Acceptance: every bundled asset resolves to a provenance record; selected Pokémon expose their individual credits; release packaging rejects unresolved artwork; README and in-app Credits describe the same shipped material. Original/repacked/recoloured assets must be described accurately.
