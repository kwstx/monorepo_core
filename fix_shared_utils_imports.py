import os

root_dir = "c:/Users/galan/agent-infra-monorepo"

for dirpath, dirnames, filenames in os.walk(root_dir):
    if "node_modules" in dirpath or "__pycache__" in dirpath:
        continue
    for file in filenames:
        if file.endswith(".py"):
            filepath = os.path.join(dirpath, file)
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
                
            new_content = content.replace("shared_utils.logger", "shared_utils.logger")
            new_content = new_content.replace("shared_utils", "shared_utils")
            
            if new_content != content:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
