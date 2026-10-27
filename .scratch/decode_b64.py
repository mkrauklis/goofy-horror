import sys, json, base64

src_path = sys.argv[1]
out_path = sys.argv[2]

with open(src_path, encoding='utf-8') as f:
    arr = json.load(f)
inner = json.loads(arr[0]['text'])
obj = json.loads(inner) if isinstance(inner, str) else inner
b64 = obj['dataUrl'].split(',', 1)[1]
with open(out_path, 'wb') as out:
    out.write(base64.b64decode(b64))
print('wrote', len(b64), 'bytes b64 ->', out_path)
