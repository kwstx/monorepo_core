import os
import glob

base_dir = r"c:\Users\galan\agent-infra-monorepo"

dirs_to_check = [
    os.path.join(base_dir, "packages"),
    os.path.join(base_dir, "apps", "autonomy_server")
]

for d in dirs_to_check:
    for root, _, files in os.walk(d):
        if "__init__.py" in files:
            p = os.path.join(root, "__init__.py")
            try:
                with open(p, "r", encoding="utf-8") as f:
                    content = f.read()
            except UnicodeDecodeError:
                with open(p, "r", encoding="utf-16") as f:
                    content = f.read()
            if "__version__" not in content:
                # Open with correct encoding to append
                mode = "a"
                enc = "utf-8"
                try:
                    with open(p, "r", encoding="utf-8") as f: f.read()
                except UnicodeDecodeError:
                    enc = "utf-16"
                
                with open(p, mode, encoding=enc) as f:
                    f.write("\n__version__ = \"0.1.0\"\n")
                print(f"Added version to {p} (encoding={enc})")
            else:
                print(f"Version already in {p}")
