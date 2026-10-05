"""Fetch immutable CC0 source files; game builds use committed processed GLBs."""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
LOCK = json.loads((ROOT / 'sources/art/assets.lock.json').read_text())
for asset in LOCK['assets']:
    destination = ROOT / '.art-cache' / asset['name']
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = urllib.request.urlopen(asset['url'], timeout=120).read()
    if hashlib.sha256(data).hexdigest() != asset['sha256']:
        raise RuntimeError('Source checksum mismatch: ' + asset['name'])
    destination.write_bytes(data)
    print('Verified', asset['name'])
