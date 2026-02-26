import os

files = [
    "packages/actionable_logic/pyproject.toml",
    "packages/simulation_layer/pyproject.toml",
    "packages/task_formation/pyproject.toml"
]

for fpath in files:
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    
    # Remove BOM if exists
    if content.startswith('\ufeff'):
        content = content[1:]
        
    # Some older files were utf-16 encoded, let's just make sure we write clean utf-8
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content.replace('\x00', ''))
