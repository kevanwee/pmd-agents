"""Import a pinned, local-only PMD study pack. Never republishes game artwork."""
from pathlib import Path
from urllib.request import urlopen
import argparse, hashlib, json, xml.etree.ElementTree as ET
from PIL import Image
import io, shutil
REV = "47e5b9920bc5b2b491c53b18076300dc6813f103"
RAW = f"https://raw.githubusercontent.com/PMDCollab/SpriteCollab/{REV}/"
ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--output", default=str(ROOT / "assets/local"))
parser.add_argument("--voracity", default=str(ROOT.parent / "voracity"))
args = parser.parse_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
records = []
def save(rel, data, source):
    path = out / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    records.append({"file":rel,"source":source,"sha256":hashlib.sha256(data).hexdigest(),"distribution":"local-reference-only","changes":"Unmodified"})
    return data
def get(rel, target=None):
    target = target or ("sources/" + rel)
    existing = out / target
    data = existing.read_bytes() if existing.exists() else urlopen(RAW + rel, timeout=30).read()
    return save(target, data, RAW + rel)
names = get("spritebot_credits.txt").decode()
def artists(credits):
    result=[]
    for line in credits.splitlines():
        fields=line.split("\t")
        if len(fields)<2: continue
        ident=fields[1]
        match=next((ln for ln in names.splitlines() if ident in ln), ident)
        result.append(match.split('\t')[0])
    return list(dict.fromkeys(result))
manifest={"version":1,"revision":REV,"sprites":[],"maps":[],"credits":[]}
roster=json.loads((ROOT/"assets/roster.json").read_text(encoding="utf-8"))
for item in roster+[{"name":"Substitute","number":"0000/0001","element":"normal"}]:
    species,number=item["name"],item["number"]
    is_dummy=species=="Substitute"
    print(f"Importing {species}...",flush=True)
    root=f"sprite/{number}/"
    xml=ET.fromstring(get(root+"AnimData.xml"))
    nodes={n.findtext("Name"):n for n in xml.findall("./Anims/Anim")}
    credit=get(root+"credits.txt").decode()
    entry={"id":species.lower(),"name":species,"dex":int(number.split('/')[0]),"element":item["element"],"source":RAW+root,"artists":artists(credit),"creditRecord":credit,"animations":{}}
    actions=["Idle","Hurt"] if is_dummy else ["Idle","Walk","Attack","Sleep"]+(["Shoot"] if "Shoot" in nodes else [])
    for action in actions:
        key=action; visited=set()
        while nodes[key].findtext("CopyOf"):
            if key in visited: raise ValueError("Animation alias cycle")
            visited.add(key);key=nodes[key].findtext("CopyOf")
        node=nodes[key]
        w,h=int(node.findtext("FrameWidth")),int(node.findtext("FrameHeight"))
        durations=[int(d.text) for d in node.findall("./Durations/Duration")]
        filename=f"{species.lower()}/{key}.png"
        image=Image.open(io.BytesIO(get(root+key+"-Anim.png",filename))).convert("RGBA")
        shadow=Image.open(io.BytesIO(get(root+key+"-Shadow.png"))).convert("RGBA")
        offsets=Image.open(io.BytesIO(get(root+key+"-Offsets.png"))).convert("RGBA")
        if image.size!=shadow.size or image.size!=offsets.size or image.width!=w*len(durations) or image.height//h not in [1,8] or image.height%h:
            raise ValueError(f"Unexpected sheet geometry: {species} {action}")
        anchors=[];heads=[]
        for row in range(image.height//h):
            anchors.append([]);heads.append([])
            for frame in range(len(durations)):
                points=[(x,y) for y in range(h) for x in range(w) if shadow.getpixel((frame*w+x,row*h+y))==(255,255,255,255)]
                if len(points)!=1: raise ValueError(f"Missing/ambiguous shadow anchor: {species} {action} {row} {frame}")
                anchors[-1].append(points[0])
                head=[(x,y) for y in range(h) for x in range(w) if offsets.getpixel((frame*w+x,row*h+y))==(0,0,0,255)]
                heads[-1].append(head[0] if len(head)==1 else points[0])
        entry["animations"][action]={"file":filename,"w":w,"h":h,"rows":image.height//h,"durations":durations,"anchors":anchors,"heads":heads,"hit":int(node.findtext("HitFrame","0"))}
    if is_dummy:
        manifest["dummy"]=entry
        continue
    try:
        portrait=f"{species.lower()}/portrait.png"
        get(f"portrait/{number}/Normal.png",portrait)
        pc=get(f"portrait/{number}/credits.txt").decode()
        entry["portrait"]=portrait;entry["portraitCredits"]=artists(pc)
    except Exception as error:
        raise RuntimeError(f"Portrait provenance unavailable for {species}") from error
    manifest["sprites"].append(entry)
source=Path(args.voracity)
mapfile=source/"public/pmd/thunder-meadow.png"
if not mapfile.exists(): raise SystemExit("Supply --voracity with the existing local Voracity checkout")
save("maps/thunder-meadow.png",mapfile.read_bytes(),"Voracity public/pmd/thunder-meadow.png; Mystery Dungeon Wiki, original game artwork")
manifest["maps"].append({"id":"meadow","name":"Thunder Meadow","subtitle":"Guild training ground","file":"maps/thunder-meadow.png","width":456,"height":335,"credit":"Pokémon Mystery Dungeon: Red / Blue Rescue Team · game artwork; local Voracity reference, Wiki attribution; ripper not verified"})
save("PixelifySans.woff2",(source/"public/fonts/PixelifySans.woff2").read_bytes(),"Voracity / Pixelify Sans Project Authors")
save("PixelifySans-OFL.txt",(source/"public/fonts/PixelifySans-OFL.txt").read_bytes(),"https://github.com/eifetx/Pixelify-Sans")
get("LICENSE.md")
manifest["files"]=records
(out/"manifest.json.tmp").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
(out/"manifest.json.tmp").replace(out/"manifest.json")
print(f"Imported {len(manifest['sprites'])} Pokémon, a Substitute dummy, one map and {len(records)} source receipts into {out}")
