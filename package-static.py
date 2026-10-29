#!/usr/bin/env python3
"""Package the no-build app with content-hashed assets for immutable CDNs."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent


def package(destination):
    assets = {}
    names = {}

    def add(name, data=None):
        data = (ROOT / name).read_bytes() if data is None else data
        digest = hashlib.sha256(data).hexdigest()
        original = Path(name)
        hashed = str(original.with_name(f'{original.stem}.{digest[:16]}{original.suffix}'))
        assets[hashed] = data
        names[name] = hashed

    # Worker/app hashes are calculated after rewriting their dependencies.
    for file in sorted(ROOT.glob('*.js')):
        if file.name not in ('app.js', 'generator-worker.js'):
            add(file.name)
    add('vendor/mp4-muxer.js')
    add('style.css')

    def rewrite(text):
        # Only exact asset references are replaced; code and artwork data remain intact.
        pattern = r'([\'\"])([^\'\"\n]+)\1'

        def replace(match):
            original = match[2].split('?', 1)[0]
            return match[1] + names[original] + match[1] if original in names else match[0]

        return re.sub(pattern, replace, text)

    add('generator-worker.js', rewrite((ROOT / 'generator-worker.js').read_text()).encode())
    add('app.js', rewrite((ROOT / 'app.js').read_text()).encode())
    index = rewrite((ROOT / 'index.html').read_text()).encode()
    assets['index.html'] = index
    for name in ('README.md', 'vendor/mp4-muxer.LICENSE', 'source/canopyu-pattern-1.svg',
                 'exports/01-supplied-artwork.mp4', 'exports/03-coral-square-core.mp4',
                 'exports/04-folded-contours.mp4', 'exports/05-generated-coral.mp4'):
        assets[name] = (ROOT / name).read_bytes()

    # Check actual HTML/worker URLs instead of relying only on the replacement map.
    for url in re.findall(r'(?:src|href)=[\'\"]([^\'\"]+)', index.decode()):
        if url.endswith(('.js', '.css', '.mp4')) and url not in assets:
            raise ValueError(f'Missing packaged asset: {url}')
    worker = assets[names['generator-worker.js']].decode()
    imports = re.search(r'importScripts\((.*?)\)', worker).group(1)
    for url in re.findall(r'[\'\"]([^\'\"]+)[\'\"]', imports):
        if url not in assets:
            raise ValueError(f'Missing worker dependency: {url}')

    manifest = {
        'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'assetNames': names,
        'files': {name: hashlib.sha256(data).hexdigest() for name, data in assets.items()},
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in assets.items():
            archive.writestr(name, data)
    manifest_path = destination.with_suffix('.manifest.json')
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'archive': str(destination.resolve()), 'manifest': str(manifest_path.resolve()),
                      'sizeBytes': destination.stat().st_size,
                      'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                      'files': len(assets)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    package(parser.parse_args().destination)
