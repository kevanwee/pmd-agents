"""Fail closed on unexpected VSIX files; this is a packaging check, not IP clearance."""
import json
from pathlib import Path
import sys
import zipfile
import xml.etree.ElementTree as ET

EXPECTED = {
    'extension.vsixmanifest', '[Content_Types].xml',
    'extension/LICENSE.txt', 'extension/NOTICE.md', 'extension/package.json',
    'extension/readme.md', 'extension/dist/extension.cjs', 'extension/dist/hook.cjs',
    'extension/media/app.js', 'extension/media/style.css', 'extension/media/widget.html',
    'extension/native/Microsoft.Web.WebView2.Core.dll',
    'extension/native/Microsoft.Web.WebView2.WinForms.dll',
    'extension/native/PmdWidget.exe', 'extension/native/WebView2-LICENSE.txt',
    'extension/native/WebView2Loader.dll',
}

def verify(path):
    root = Path(__file__).resolve().parent.parent
    package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != EXPECTED:
            raise ValueError(f'VSIX inventory mismatch: extra={set(names) - EXPECTED}, missing={EXPECTED - set(names)}')
        if archive.testzip() is not None:
            raise ValueError('Corrupt VSIX member')
        shipped = json.loads(archive.read('extension/package.json'))
        if shipped != package:
            raise ValueError('Packaged manifest differs from source')
        manifest = ET.fromstring(archive.read('extension.vsixmanifest'))
        identity = manifest.find('.//{*}Identity')
        if identity is None or identity.attrib.get('Version') != package['version']:
            raise ValueError('VSIX version differs from package.json')
        for name in EXPECTED - {'extension.vsixmanifest', '[Content_Types].xml', 'extension/package.json'}:
            relative = name.removeprefix('extension/')
            relative = {'LICENSE.txt': 'LICENSE', 'readme.md': 'README.md'}.get(relative, relative)
            source = (root / relative).read_bytes()
            bundled = archive.read(name)
            # vsce rewrites relative README links to repository URLs.
            if relative != 'README.md' and bundled != source:
                raise ValueError(f'Packaged bytes differ: {relative}')
            if not bundled:
                raise ValueError(f'Empty package member: {name}')
    print(f'Verified {len(EXPECTED)} files, version {package["version"]}; artwork directories and screenshots excluded.')

if __name__ == '__main__':
    verify(sys.argv[1])
