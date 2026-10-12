"""Refresh only scenery in an existing local pack, preserving Pokemon and preferences.

All 57 Red Rescue Team Friend Areas are decoded from pinned pret/pmd-red data. The Explorers of Sky areas
(pinned pret/pmd-sky data) also import when skytemple-files is installed (Python 3.10-3.13); otherwise they
are skipped and the pack keeps every Rescue Team area.
"""
import hashlib, json
from pathlib import Path
from rescue_scenery import export, MAPS
from rescue_maps import export as export_any
ROOT=Path(__file__).resolve().parents[1]
CREDIT='Pokemon Mystery Dungeon: Red Rescue Team; original game artwork, decoded from pinned pret/pmd-red map data. Local reference only.'
SKY_CREDIT='Pokemon Mystery Dungeon: Explorers of Sky; original game artwork, decoded from pinned pret/pmd-sky map data. Local reference only.'
KEYS=['BOUNTIFUL_SEA','TREASURE_SEA','SERENE_SEA','DEEP_SEA_FLOOR','DEEP_SEA_CURRENT','SEAFLOOR_CAVE','SHALLOW_BEACH','MT_DEEPGREEN','MT_CLEFT','MT_MOONVIEW','RAINBOW_PEAK',
      'WILD_PLAINS','BEAU_PLAINS','SKY_BLUE_PLAINS','SAFARI','SCORCHED_PLAINS','SACRED_FIELD','MIST_RISE_FOREST','FLYAWAY_FOREST','OVERGROWN_FOREST','ENERGETIC_FOREST',
      'MUSHROOM_FOREST','HEALING_FOREST','TRANSFORM_FOREST','SECRETIVE_FOREST','RUB_A_DUB_RIVER','TADPOLE_POND','TURTLESHELL_POND','MYSTIC_LAKE','WATERFALL_LAKE',
      'PEANUT_SWAMP','POISON_SWAMP','ECHO_CAVE','CRYPTIC_CAVE','DRAGON_CAVE','BOULDER_CAVE','JUNGLE','DECREPIT_LAB','MT_DISCIPLINE','THUNDER_MEADOW','POWER_PLANT',
      'CRATER','FURNACE_DESERT','AGED_CHAMBER_AN','AGED_CHAMBER_O_EXCLAIM','ANCIENT_RELIC','DARKNESS_RIDGE','FRIGID_CAVERN','ICE_FLOE_BEACH','VOLCANIC_PIT',
      'STRATOS_LOOKOUT','RAVAGED_FIELD','MAGNETIC_QUARRY','LEGENDARY_ISLAND','SOUTHERN_ISLAND','ENCLOSED_ISLAND','FINAL_ISLAND']

def key_of(area_id):
    """pret's FRIEND_AREA_* name for an area id (ids are the names without underscores, lower case)."""
    return next(k for k in KEYS if k.replace('_','').lower()==area_id)

def import_scenery(out, manifest):
    out=Path(out); maps=[]; records=[]
    areas=json.loads((ROOT/'assets/friend-areas.json').read_text(encoding='utf-8'))
    names={a['id']:a['name'] for a in areas}
    names.update(transformforest='Transform Forest',thundermeadow='Thunder Meadow')
    def add(area, result, credit):
        layers=[dict(file='maps/'+l['src'],credit=credit,**{k:v for k,v in l.items() if k!='src'}) for l in result['layers']]
        maps.append(dict(id={'transformforest':'forest','thundermeadow':'meadow'}.get(area,area),name=names[area],subtitle='Original Friend Area',file='maps/'+result['background'],width=result['size'][0],height=result['size'][1],credit=credit,layers=layers))
        for source in result['sources']:
            records.append(dict(file='sources/scenery/'+source['url'].rsplit('/',1)[1],source=source['url'],sha256=source['sha256'],distribution='local-reference-only',changes='Unmodified native map data'))
        for filename in [result['background'],area+'-source.json']+[l['src'] for l in result['layers']]:
            records.append(dict(file='maps/'+filename,source=result['sources'][0]['url'],sha256=hashlib.sha256((out/'maps'/filename).read_bytes()).hexdigest(),distribution='local-reference-only',changes='Decoded tiles, RGB555 palette cycles, tile animation and native frame durations; source hashes in map receipt'))
    for area in MAPS:
        add(area,export(area,out/'maps',out/'sources/scenery'),CREDIT)
    # The remaining Rescue Team areas: tile animation and layered maps need the fuller decoder.
    for area in areas:
        if area['id'] in MAPS or area.get('map'): continue
        add(area['id'],export_any(key_of(area['id']),area['id'],out/'maps',out/'sources/scenery'),CREDIT)
    try:
        from sky_scenery import export as export_sky
    except ImportError:
        print('Explorers of Sky areas skipped: install skytemple-files (Python 3.10-3.13) to include them.')
    else:
        for area in areas:
            if area.get('map'): add(area['id'],export_sky(area['map'],area['id'],out/'maps',out/'sources/scenery'),SKY_CREDIT)
    replaced={r['file'] for r in records}
    manifest['files']=[r for r in manifest.get('files',[]) if r['file'] not in replaced]+records
    # Keep stable ids for existing saved scene preferences.
    manifest['maps']=sorted(maps,key=lambda m:(0 if m['id']=='meadow' else 1 if m['id']=='forest' else 2))
    return manifest

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'assets/local'));args=parser.parse_args();out=Path(args.output)
    path=out/'manifest.json';manifest=import_scenery(out,json.loads(path.read_text(encoding='utf-8')))
    temp=path.with_suffix('.json.tmp');temp.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');temp.replace(path)
    print(f"Imported {len(manifest['maps'])} native Friend Areas; existing Pokemon preserved.")
