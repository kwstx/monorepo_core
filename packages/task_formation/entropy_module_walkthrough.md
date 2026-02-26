# EntropyConstraintModule: Maintenance of Cooperative Diversity

The `EntropyConstraintModule` is designed to prevent influence monopolization within a pool of candidate teams. Even if certain agents are projected to have high individual impact, over-reliance on them across all team formations can lead to structural fragility and reduced systemic diversity.

## Core Mechanisms

### 1. Influence Concentration Analysis
The module monitors the **aggregate influence** each agent would have across the entire pool of candidate teams, weighted by their selection probabilities. 
- It calculates the **Variance** of this influence distribution.
- it calculates the **Cooperative Entropy**, measuring how "spread out" the influence is across the available agent pool.

### 2. Automatic Probability Adjustment
If the variance exceeds a defined threshold or the diversity ratio falls below the minimum, the module triggers a selection bias adjustment:
- It identifies agents who are "over-concentrated" (exceeding their fair share of influence).
- It applies a **penalty** to candidate teams that include these agents.
- The selection probabilities are redistributed to favor more diverse teams that still maintain high synergy potential.

## Integration Example

```python
from entropy_constraint_module import EntropyConstraintModule, TeamCandidate

# 1. Define candidate teams from the matching engine/evaluator
candidates = [
    TeamCandidate("Team_A", ("Alpha", "Beta"), 0.85, {"Alpha": 0.5, "Beta": 0.35}),
    TeamCandidate("Team_B", ("Alpha", "Gamma"), 0.82, {"Alpha": 0.5, "Gamma": 0.32}),
    # ...
]

# 2. Initial selection probabilities based on synergy scores
base_probs = [0.5, 0.5] 

# 3. Apply entropy constraints
ecm = EntropyConstraintModule(variance_threshold=0.01)
diverse_probabilities = ecm.adjust_candidate_probabilities(candidates, base_probs)

# 4. Resulting probabilities now favor combinations that avoid over-centralizing 'Alpha'
```

## Performance Preservation
The adjustment mechanism uses an exponential damping factor that moderates the selection probability without completely discarding high-performance teams. This ensures that the system still prioritizes **Synergy Density** while gradually nudging the formation process toward a more stable, diverse equilibrium.
