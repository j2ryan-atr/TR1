from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
if dist.exists(): shutil.rmtree(dist)
dist.mkdir()
for p in root.rglob('*'):
    if p.is_dir() or 'dist' in p.parts or '.git' in p.parts: continue
    rel=p.relative_to(root)
    if rel.parts[0] in {'scripts'} or rel.name.endswith('.zip'): continue
    out=dist/rel; out.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,out)
print(f'Built {dist}')
