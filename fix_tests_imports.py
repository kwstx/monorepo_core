import os

paths = [
    ("packages/actionable_logic/tests", "src.", "actionable_logic."),
    ("packages/actionable_logic/tests", "from src ", "from actionable_logic "),
    ("packages/simulation_layer/tests", "src.", "simulation_layer."),
    ("packages/task_formation/tests", "from task_formation.task_formation.", "from task_formation."),
    ("packages/task_formation/tests", "from src.", "from task_formation.")
]

for directory, old_str, new_str in paths:
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                
                new_content = content.replace(old_str, new_str)
                if new_content != content:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_content)
