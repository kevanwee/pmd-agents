"""Refresh only scenery in an existing local pack, preserving Pokemon and preferences."""
import hashlib, json
from pathlib import Path
from rescue_scenery import export, MAPS
ROOT=Path(__file__).resolve().parents[1]
CREDIT='Pokemon Mystery Dungeon: Red Rescue Team; original game artwork, decoded from pinned pret/pmd-red map data. Local reference only.'
def import_scenery(out, manifest):
    out=Path(out); maps=[]; records=[]
    names={a['id']:a['name'] for a in json.loads((ROOT/'assets/friend-areas.json').read_text())}
    names.update(transformforest='Transform Forest',thundermeadow='Thunder Meadow')
    for area in MAPS:
        result=export(area,out/'maps',out/'sources/scenery')
        layers=[dict(file='maps/'+l['src'],credit=CREDIT,**{k:v for k,v in l.items() if k!='src'}) for l in result['layers']]
        maps.append(dict(id={'transformforest':'forest','thundermeadow':'meadow'}.get(area,area),name=names[area],subtitle='Original Friend Area',file='maps/'+result['background'],width=result['size'][0],height=result['size'][1],credit=CREDIT,layers=layers))
        for source in result['sources']:
            records.append(dict(file='sources/scenery/'+source['url'].rsplit('/',1)[1],source=source['url'],sha256=source['sha256'],distribution='local-reference-only',changes='Unmodified native map data'))
        for filename in [result['background'],area+'-source.json']+[l['src'] for l in result['layers']]:
            records.append(dict(file='maps/'+filename,source=result['sources'][0]['url'],sha256=hashlib.sha256((out/'maps'/filename).read_bytes()).hexdigest(),distribution='local-reference-only',changes='Decoded tiles, RGB555 palette cycles and native frame durations; source hashes in map receipt'))
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
