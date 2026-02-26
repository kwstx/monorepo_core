import os
import re

tests_dir = "packages/task_formation/tests"

patterns = [
    r"^(import|from)\s+(adaptive_formation_api)",
    r"^(import|from)\s+(complementarity_analyzer)",
    r"^(import|from)\s+(cooperative_context_model)",
    r"^(import|from)\s+(counterfactual_team_evaluator)",
    r"^(import|from)\s+(entropy_constraint_module)",
    r"^(import|from)\s+(matching_engine)",
    r"^(import|from)\s+(synergy_forecast_simulator)",
    r"^(import|from)\s+(team_optimizer)",
    r"^(import|from)\s+(cooperative_intelligence)",
]

for root, dirs, files in os.walk(tests_dir):
    for file in files:
        if file.endswith(".py"):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = content
            for p in patterns:
                new_content = re.sub(p, r"\1 task_formation.\2", new_content, flags=re.MULTILINE)
                
            if new_content != content:
                print(f"fixed {filepath}")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
