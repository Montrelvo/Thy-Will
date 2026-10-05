"""Install the exact official Linux Blender build into an ignored local tools folder."""
import hashlib
import shutil
import subprocess
import tarfile
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / '.art-tools'
TOOLS.mkdir(exist_ok=True)
ARCHIVE = TOOLS / 'blender-4.5.3-linux-x64.tar.xz'
URL = 'https://download.blender.org/release/Blender4.5/blender-4.5.3-linux-x64.tar.xz'
SHA = '975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845'
if not ARCHIVE.exists():
    with urllib.request.urlopen(URL, timeout=120) as response, ARCHIVE.open('wb') as output:
        shutil.copyfileobj(response, output)
if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() != SHA:
    raise RuntimeError('Blender archive checksum mismatch')
with tarfile.open(ARCHIVE) as archive:
    archive.extractall(TOOLS, filter='data')
blender = TOOLS / 'blender-4.5.3-linux-x64/blender'
subprocess.run([str(blender), '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(ROOT / 'scripts/art/process_knight.py')], check=True)
