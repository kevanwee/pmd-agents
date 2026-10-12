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
    actions=["Idle","Hurt"] if is_dummy else ["Idle","Walk","Attack","Sleep"]+[a for a in ["Shoot","Strike","QuickStrike","MultiStrike","SpAttack"] if a in nodes]
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
# Scenery and font come from pinned public sources; each download is checked against its recorded hash.
FONT="https://raw.githubusercontent.com/eifetx/Pixelify-Sans/39df74aba80df8157546034b878e8be1eb565ced/"
def fetch(url, target, sha=None):
    existing = out / target
    data = existing.read_bytes() if existing.exists() else urlopen(url, timeout=30).read()
    if sha and hashlib.sha256(data).hexdigest()!=sha: raise SystemExit(f"Unexpected download for {target}: {url}")
    return save(target, data, url)
fetch(FONT+"fonts/webfonts/PixelifySans-Regular.woff2","PixelifySans.woff2","bb28dc5142ee7882fa4e66f787f76a6d6abb697dc644a4ce2cf46182c642a152")
fetch(FONT+"OFL.txt","PixelifySans-OFL.txt","b66ba46f511a851ab09998b5a5a9fdbb102545a3864cb993095e1745996873a7")
get("LICENSE.md")
manifest["files"]=records
from import_scenery import import_scenery
manifest=import_scenery(out,manifest)
(out/"manifest.json.tmp").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
(out/"manifest.json.tmp").replace(out/"manifest.json")
print(f"Imported {len(manifest['sprites'])} Pokémon, a Substitute dummy, {len(manifest['maps'])} maps and {len(records)} source receipts into {out}")
