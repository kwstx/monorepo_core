from __future__ import annotations
import random
from dataclasses import dataclass
from typing import List, Tuple, Dict, Sequence, Optional
import numpy as np

from cooperative_intelligence import CooperativeIntelligenceVector
from cooperative_context_model import CooperativeContextTensor, CooperativeContextModel
from complementarity_analyzer import ComplementarityAnalyzer
from entropy_constraint_module import EntropyConstraintModule, TeamCandidate
from counterfactual_team_evaluator import CounterfactualTeamEvaluator
from matching_engine import MatchingEngine


@dataclass(frozen=True)
class OptimizationWeights:
    """Weights and constraints for the multi-objective optimization function."""
    impact: float = 0.35
    synergy: float = 0.20
    alignment: float = 0.15
    influence_balance: float = 0.15
    entropy_diversity: float = 0.15
    
    # Hard constraints
    min_entropy_diversity: float = 0.75


@dataclass(frozen=True)
class TeamOptimizationResult:
    """Summary of the optimized team configuration."""
    team: List[CooperativeIntelligenceVector]
    fitness: float
    metrics: Dict[str, float]


class TeamOptimizer:
    """
    Solves the multi-agent team formation problem as a constrained optimization.
    
    Simultaneously maximizes:
    1. Projected downstream impact (via CounterfactualTeamEvaluator)
    2. Synergy density (via structural complementarity and historical patterns)
    3. Cooperative intelligence alignment (via MatchingEngine scoring)
    4. Trust-calibrated influence balance (via trust weight distribution)
    5. Entropy diversity constraints (via influence concentration analysis)
    """

    def __init__(
        self,
        evaluator: CounterfactualTeamEvaluator,
        analyzer: ComplementarityAnalyzer,
        entropy_module: EntropyConstraintModule,
        weights: OptimizationWeights = OptimizationWeights()
    ) -> None:
        self.evaluator = evaluator
        self.analyzer = analyzer
        self.entropy_module = entropy_module
        self.weights = weights

    def optimize(
        self,
        task: CooperativeContextTensor,
        available_agents: List[CooperativeIntelligenceVector],
        min_team_size: int = 2,
        max_team_size: int = 5,
        population_size: int = 40,
        generations: int = 25,
        mutation_rate: float = 0.1
    ) -> TeamOptimizationResult:
        """
        Executes a Genetic Algorithm to find the optimal team configuration.
        """
        if len(available_agents) < min_team_size:
            raise ValueError(f"Insufficient agents ({len(available_agents)}) for min team size ({min_team_size})")

        # 1. Initialize Population
        population: List[List[CooperativeIntelligenceVector]] = []
        for _ in range(population_size):
            size = random.randint(min_team_size, min(max_team_size, len(available_agents)))
            team = random.sample(available_agents, size)
            population.append(team)

        best_team = population[0]
        best_fitness = -1.0
        best_metrics = {}

        # 2. Evolutionary Loop
        for gen in range(generations):
            fitness_scores = []
            results = []

            for team in population:
                fit, metrics = self.calculate_fitness(task, team)
                fitness_scores.append(fit)
                results.append((team, fit, metrics))

                if fit > best_fitness:
                    best_fitness = fit
                    best_team = team
                    best_metrics = metrics

            # Selection (Tournament Selection)
            new_population = [best_team]  # Elitism
            while len(new_population) < population_size:
                parent1 = self._tournament_selection(population, fitness_scores)
                parent2 = self._tournament_selection(population, fitness_scores)
                
                # Crossover
                child = self._crossover(parent1, parent2, available_agents, min_team_size, max_team_size)
                
                # Mutation
                child = self._mutate(child, available_agents, mutation_rate, min_team_size, max_team_size)
                
                new_population.append(child)
            
            population = new_population

        return TeamOptimizationResult(
            team=best_team,
            fitness=best_fitness,
            metrics=best_metrics
        )

    def calculate_fitness(
        self, 
        task: CooperativeContextTensor, 
        team: List[CooperativeIntelligenceVector]
    ) -> Tuple[float, Dict[str, float]]:
        """
        Computes the weighted multi-objective fitness for a candidate team.
        """
        # A. Projected Downstream Impact & Synergy Density
        # We use the evaluator to get simulation-based projections
        eval_res = self.evaluator.evaluate_team(task, team)
        
        impact_score = eval_res.expected_combined_impact
        # Normalize impact: assuming a theoretical max impact per agent is ~1.0, 
        # so max team impact is around team_size.
        norm_impact = min(1.0, impact_score / (len(team) * 1.5)) 
        
        # Synergy Density (from the forecast simulation)
        # We normalize synergy density which is often in range [-1, 1] or similar
        synergy_score = max(0.0, min(1.0, 0.5 + eval_res.synergy_density))

        # B. Cooperative Intelligence Alignment
        # Mean alignment score for all agents in the team
        alignment_scores = [MatchingEngine.score_agent_alignment(task, agent) for agent in team]
        avg_alignment = sum(alignment_scores) / len(team)
        
        # C. Trust-Calibrated Influence Balance
        # synergy_forecast_simulator calculates trust_weight_max_share and trust_weight_entropy.
        # Higher entropy and lower max_share means better balance.
        balance_score = (1.0 - eval_res.trust_weight_max_share) * 0.7 + \
                        (eval_res.team_prediction_reliability) * 0.3

        # D. Entropy Diversity Constraints
        # We measure how influence is distributed across the participating agents.
        influence_projections = {
            a.agent_id: (CooperativeContextModel.compute_alignment_score(task, a.capability_profile) * 
                         a.marginal_cooperative_influence_consistency)
            for a in team
        }
        entropy_metrics = self.entropy_module.calculate_metrics(influence_projections)
        diversity_score = entropy_metrics.get("diversity_ratio", 0.0)

        # Weighted Sum
        fitness = (
            self.weights.impact * norm_impact +
            self.weights.synergy * synergy_score +
            self.weights.alignment * avg_alignment +
            self.weights.influence_balance * balance_score +
            self.weights.entropy_diversity * diversity_score
        )

        # Apply Hard Constraint Penalties
        if diversity_score < self.weights.min_entropy_diversity:
            # Gradually penalize teams that fall below the diversity threshold
            penalty = (self.weights.min_entropy_diversity - diversity_score) * 2.0
            fitness = max(0.01, fitness - penalty)

        metrics = {
            "norm_impact": round(norm_impact, 4),
            "synergy_score": round(synergy_score, 4),
            "avg_alignment": round(avg_alignment, 4),
            "balance_score": round(balance_score, 4),
            "diversity_score": round(diversity_score, 4),
            "raw_expected_impact": round(impact_score, 4)
        }

        return fitness, metrics

    def _tournament_selection(
        self, 
        population: List[List[CooperativeIntelligenceVector]], 
        fitness_scores: List[float], 
        k: int = 3
    ) -> List[CooperativeIntelligenceVector]:
        selected_indices = random.sample(range(len(population)), k)
        best_idx = max(selected_indices, key=lambda i: fitness_scores[i])
        return population[best_idx]

    def _crossover(
        self, 
        p1: List[CooperativeIntelligenceVector], 
        p2: List[CooperativeIntelligenceVector],
        available_agents: List[CooperativeIntelligenceVector],
        min_size: int,
        max_size: int
    ) -> List[CooperativeIntelligenceVector]:
        """Combines two parents into a child team while respecting constraints."""
        # Simple set union + truncation or subset selection
        combined_ids = set(a.agent_id for a in p1) | set(a.agent_id for a in p2)
        
        # Turn IDs back to agent objects
        agent_map = {a.agent_id: a for a in available_agents}
        combined_agents = [agent_map[aid] for aid in combined_ids]
        
        target_size = random.randint(min_size, max_size)
        if len(combined_agents) >= target_size:
            return random.sample(combined_agents, target_size)
        else:
            # If union is smaller than min_size (unlikely but possible), pad it
            remaining = [a for a in available_agents if a.agent_id not in combined_ids]
            needed = target_size - len(combined_agents)
            if remaining:
                combined_agents.extend(random.sample(remaining, min(needed, len(remaining))))
            return combined_agents

    def _mutate(
        self, 
        team: List[CooperativeIntelligenceVector], 
        available_agents: List[CooperativeIntelligenceVector],
        rate: float,
        min_size: int,
        max_size: int
    ) -> List[CooperativeIntelligenceVector]:
        """Applies mutation by swapping, adding, or removing agents."""
        if random.random() > rate:
            return team

        mutated = list(team)
        operation = random.choice(["swap", "add", "remove"])
        
        agent_map = {a.agent_id: a for a in available_agents}
        current_ids = set(a.agent_id for a in mutated)
        available_not_in_team = [a for a in available_agents if a.agent_id not in current_ids]

        if operation == "swap" and mutated and available_not_in_team:
            idx = random.randrange(len(mutated))
            mutated[idx] = random.choice(available_not_in_team)
        elif operation == "add" and len(mutated) < max_size and available_not_in_team:
            mutated.append(random.choice(available_not_in_team))
        elif operation == "remove" and len(mutated) > min_size:
            mutated.pop(random.randrange(len(mutated)))
            
        return mutated
