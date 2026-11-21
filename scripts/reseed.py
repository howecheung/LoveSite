import json, re, io, base64, urllib.request, uuid
W = "/vol1/@apphome/hermes-webui/data/workspace/ai-couple"
txt = open(W + "/CREDENTIALS.txt").read()
em = re.search(r"超管 (\S+)", txt).group(1)
pw = re.search(r"超管 \S+\s+(\S+)", txt).group(1)
req = urllib.request.Request("http://127.0.0.1:8094/api/collections/_superusers/auth-with-password", method="POST")
req.add_header("Content-Type", "application/json")
TOK = json.loads(urllib.request.urlopen(req, json.dumps({"identity": em, "password": pw}).encode()).read())["token"]
def api(p, m="GET", b=None):
    r2 = urllib.request.Request("http://127.0.0.1:8094" + p, method=m)
    r2.add_header("Content-Type", "application/json")
    r2.add_header("Authorization", TOK)
    d = json.dumps(b).encode() if b is not None else None
    with urllib.request.urlopen(r2, d, timeout=60) as f:
        return json.loads(f.read() or b"{}")

boy = api("/api/collections/members/records?filter=(email='boy%40local.test')")["items"][0]
# 1) 老相册补归属
first = api("/api/collections/albums/records?filter=(name='%E7%AC%AC%E4%B8%80%E6%AC%A1%E6%97%85%E8%A1%8C')")["items"][0]
api("/api/collections/albums/records/" + first["id"], "PATCH", {"member": boy["id"]})
print("第一次旅行 归属 ->", boy["id"])

# 2) 重建演示相册(渐变图, boy/girl 各发一本)
from PIL import Image
def grad(i, w=400, h=400):
    pal = [(255, 214, 224), (216, 240, 192), (255, 235, 178), (199, 222, 255), (240, 210, 245), (255, 222, 190)]
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h)
            c0 = pal[i % len(pal)]; c1 = pal[(i + 2) % len(pal)]
            px[x, y] = tuple(int(a + (b2 - a) * t) for a, b2 in zip(c0, c1))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=80)
    return buf.getvalue()

def mp(fields, files):
    bd = uuid.uuid4().hex
    body = b""
    for k, v in fields.items():
        body += f"--{bd}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for fn, data in files:
        body += f"--{bd}\r\nContent-Disposition: form-data; name=\"photos\"; filename=\"{fn}\"\r\nContent-Type: image/jpeg\r\n\r\n".encode()
        body += data + b"\r\n"
    body += f"--{bd}--\r\n".encode()
    r2 = urllib.request.Request("http://127.0.0.1:8094/api/collections/albums/records", method="POST")
    r2.add_header("Content-Type", f"multipart/form-data; boundary={bd}")
    r2.add_header("Authorization", TOK)
    with urllib.request.urlopen(r2, body, timeout=90) as f:
        return json.loads(f.read())

a1 = mp({"name": "夜里的歌剧院", "note": "晚风把歌唱给了穹顶听", "member": boy["id"]},
        [(f"op{i}.jpg", grad(i + 1)) for i in range(2)])
a2 = mp({"name": "秋日山林散步", "note": "一起走了 12 公里，捡了三只猫两张狗", "member": boy["id"]},
        [(f"walk{i}.jpg", grad(i)) for i in range(12)])
print("重建:", a1["name"], len(a1["photos"]), "|", a2["name"], len(a2["photos"]))
