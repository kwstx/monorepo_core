from __future__ import annotations

from dataclasses import dataclass
from math import log
from typing import Dict, List, Sequence, Tuple
import random

from cooperative_context_model import CooperativeContextModel, CooperativeContextTensor
from cooperative_intelligence import CooperativeIntelligenceVector
from counterfactual_team_evaluator import CounterfactualTeamEvaluator, DeltaImpactReport
from entropy_constraint_module import EntropyConstraintModule
from matching_engine import MatchingEngine
from synergy_forecast_simulator import AgentCounterfactualProfile, SynergyForecast
from team_optimizer import TeamOptimizer, TeamOptimizationResult


@dataclass(frozen=True)
class ProjectedSynergyDistribution:
    sample_count: int
    mean_amplification: float
    std_amplification: float
    p05: float
    p50: float
    p95: float
    probability_positive_amplification: float
    expected_combined_impact: float
    expected_additive_impact: float


@dataclass(frozen=True)
class MarginalInfluenceContribution:
    agent_id: str
    absolute_contribution: float
    normalized_contribution_share: float
    removal_delta_total_impact: float
    removal_delta_synergy_impact: float
    structural_necessity_score: float


@dataclass(frozen=True)
class TrustWeightedPropagationFactor:
    agent_id: str
    trust_weight: float
    calibration_stability: float
    propagation_factor: float


@dataclass(frozen=True)
class EntropyScores:
    trust_weight_entropy: float
    trust_weight_entropy_ratio: float
    influence_entropy: float
    influence_entropy_ratio: float


@dataclass(frozen=True)
class StabilityForecast:
    stability_score: float
    instability_risk: float
    stability_penalty_factor: float
    team_prediction_reliability: float


@dataclass(frozen=True)
class AgentSelectionTrace:
    agent_id: str
    alignment_score: float
    structural_necessity_score: float
    removal_impact_gap: float
    top_complementarity_links: List[Tuple[str, float]]
    causal_explanation: List[str]


@dataclass(frozen=True)
class AdaptiveTeamConfiguration:
    selected_agent_ids: Tuple[str, ...]
    optimizer_fitness: float
    optimizer_metrics: Dict[str, float]
    projected_synergy_distribution: ProjectedSynergyDistribution
    marginal_cooperative_influence_contributions: List[MarginalInfluenceContribution]
    trust_weighted_propagation_factors: List[TrustWeightedPropagationFactor]
    entropy_scores: EntropyScores
    stability_forecast: StabilityForecast
    causal_explanation_traces: List[AgentSelectionTrace]


class AdaptiveFormationAPI:
    """
    Forms an adaptive team from a CooperativeContextModel-encoded task context.

    The API combines optimization, counterfactual forecasting, trust propagation,
    entropy diagnostics, and per-agent causal traces into one structured payload.
    """

    def __init__(
        self,
        context_model: CooperativeContextModel,
        optimizer: TeamOptimizer,
        evaluator: CounterfactualTeamEvaluator,
        entropy_module: EntropyConstraintModule,
    ) -> None:
        self.context_model = context_model
        self.optimizer = optimizer
        self.evaluator = evaluator
        self.entropy_module = entropy_module

    def form_team(
        self,
        task_tensor: CooperativeContextTensor,
        available_agents: Sequence[CooperativeIntelligenceVector],
        *,
        min_team_size: int = 2,
        max_team_size: int = 5,
        population_size: int = 40,
        generations: int = 25,
        mutation_rate: float = 0.1,
        random_seed: int | None = None,
    ) -> AdaptiveTeamConfiguration:
        if random_seed is not None:
            random.seed(random_seed)

        optimization_result = self.optimizer.optimize(
            task=task_tensor,
            available_agents=list(available_agents),
            min_team_size=min_team_size,
            max_team_size=max_team_size,
            population_size=population_size,
            generations=generations,
            mutation_rate=mutation_rate,
        )

        selected_team = list(optimization_result.team)
        forecast = self._forecast_selected_team(task_tensor, selected_team)

        contributions = self._build_marginal_contributions(task_tensor, selected_team)
        trust_factors = self._build_trust_weighted_propagation_factors(selected_team)
        entropy_scores = self._build_entropy_scores(forecast, contributions)
        traces = self._build_causal_traces(task_tensor, selected_team, contributions)

        distribution = forecast.projected_distribution
        projected_synergy_distribution = ProjectedSynergyDistribution(
            sample_count=distribution.sample_count,
            mean_amplification=distribution.mean_amplification,
            std_amplification=distribution.std_amplification,
            p05=distribution.p05,
            p50=distribution.p50,
            p95=distribution.p95,
            probability_positive_amplification=distribution.probability_positive_amplification,
            expected_combined_impact=distribution.expected_combined_impact,
            expected_additive_impact=distribution.expected_additive_impact,
        )

        stability_forecast = StabilityForecast(
            stability_score=forecast.stability_score,
            instability_risk=forecast.instability_risk,
            stability_penalty_factor=forecast.stability_penalty_factor,
            team_prediction_reliability=forecast.team_prediction_reliability,
        )

        return AdaptiveTeamConfiguration(
            selected_agent_ids=tuple(agent.agent_id for agent in selected_team),
            optimizer_fitness=optimization_result.fitness,
            optimizer_metrics=optimization_result.metrics,
            projected_synergy_distribution=projected_synergy_distribution,
            marginal_cooperative_influence_contributions=contributions,
            trust_weighted_propagation_factors=trust_factors,
            entropy_scores=entropy_scores,
            stability_forecast=stability_forecast,
            causal_explanation_traces=traces,
        )

    def _forecast_selected_team(
        self,
        task_tensor: CooperativeContextTensor,
        selected_team: List[CooperativeIntelligenceVector],
    ) -> SynergyForecast:
        profiles = self._create_profiles(task_tensor, selected_team)
        coalition = [agent.agent_id for agent in selected_team]
        return self.evaluator.simulator.forecast(coalition, profiles)

    def _create_profiles(
        self,
        task_tensor: CooperativeContextTensor,
        selected_team: List[CooperativeIntelligenceVector],
    ) -> List[AgentCounterfactualProfile]:
        profiles: List[AgentCounterfactualProfile] = []
        for agent in selected_team:
            alignment = self.context_model.compute_alignment_score(task_tensor, agent.capability_profile)
            consistency = max(0.0, min(1.0, agent.marginal_cooperative_influence_consistency))
            calibration = max(0.0, min(1.0, agent.predictive_calibration_reliability))
            expected_impact = max(0.01, alignment * consistency)
            uncertainty = (1.0 - calibration) * 0.4 + 0.05
            profiles.append(
                AgentCounterfactualProfile(
                    agent_id=agent.agent_id,
                    expected_impact=expected_impact,
                    uncertainty=uncertainty,
                    trust_coefficient=consistency,
                    predictive_calibration_stability=calibration,
                )
            )
        return profiles

    def _build_marginal_contributions(
        self,
        task_tensor: CooperativeContextTensor,
        selected_team: List[CooperativeIntelligenceVector],
    ) -> List[MarginalInfluenceContribution]:
        reports_by_agent: Dict[str, DeltaImpactReport] = {}
        raw_by_agent: Dict[str, float] = {}

        for agent in selected_team:
            report = self.evaluator.calculate_removal_impact(task_tensor, selected_team, agent)
            reports_by_agent[agent.agent_id] = report
            # Positive gap created by removing the agent approximates marginal necessity.
            raw_by_agent[agent.agent_id] = max(0.0, -report.delta_total_impact)

        total = sum(raw_by_agent.values())
        if total <= 1e-12:
            uniform = 1.0 / max(1, len(selected_team))
            normalized = {agent.agent_id: uniform for agent in selected_team}
        else:
            normalized = {aid: val / total for aid, val in raw_by_agent.items()}

        contributions = []
        for agent in selected_team:
            report = reports_by_agent[agent.agent_id]
            contributions.append(
                MarginalInfluenceContribution(
                    agent_id=agent.agent_id,
                    absolute_contribution=raw_by_agent[agent.agent_id],
                    normalized_contribution_share=normalized[agent.agent_id],
                    removal_delta_total_impact=report.delta_total_impact,
                    removal_delta_synergy_impact=report.delta_synergy_impact,
                    structural_necessity_score=report.structural_necessity_score,
                )
            )

        return sorted(contributions, key=lambda item: item.normalized_contribution_share, reverse=True)

    def _build_trust_weighted_propagation_factors(
        self,
        selected_team: List[CooperativeIntelligenceVector],
    ) -> List[TrustWeightedPropagationFactor]:
        raw_weights: Dict[str, float] = {}
        calibrations: Dict[str, float] = {}

        for agent in selected_team:
            consistency = max(0.0, min(1.0, agent.marginal_cooperative_influence_consistency))
            calibration = max(0.0, min(1.0, agent.predictive_calibration_reliability))
            raw_weights[agent.agent_id] = consistency * (0.20 + (0.80 * calibration))
            calibrations[agent.agent_id] = calibration

        total = sum(raw_weights.values())
        if total <= 1e-12:
            trust_weights = {agent.agent_id: 1.0 / len(selected_team) for agent in selected_team}
        else:
            trust_weights = {aid: weight / total for aid, weight in raw_weights.items()}

        factors = []
        for agent in selected_team:
            weight = trust_weights[agent.agent_id]
            calibration = calibrations[agent.agent_id]
            propagation = weight * (0.85 + (0.30 * calibration))
            factors.append(
                TrustWeightedPropagationFactor(
                    agent_id=agent.agent_id,
                    trust_weight=weight,
                    calibration_stability=calibration,
                    propagation_factor=propagation,
                )
            )

        return sorted(factors, key=lambda item: item.trust_weight, reverse=True)

    def _build_entropy_scores(
        self,
        forecast: SynergyForecast,
        contributions: List[MarginalInfluenceContribution],
    ) -> EntropyScores:
        trust_count = len(forecast.coalition)
        trust_max_entropy = log(trust_count) if trust_count > 1 else 1.0
        trust_ratio = (
            forecast.trust_weight_entropy / trust_max_entropy
            if trust_max_entropy > 1e-12
            else 1.0
        )

        influence_map = {
            item.agent_id: item.normalized_contribution_share
            for item in contributions
        }
        influence_metrics = self.entropy_module.calculate_metrics(influence_map)

        return EntropyScores(
            trust_weight_entropy=forecast.trust_weight_entropy,
            trust_weight_entropy_ratio=trust_ratio,
            influence_entropy=influence_metrics.get("entropy", 0.0),
            influence_entropy_ratio=influence_metrics.get("diversity_ratio", 1.0),
        )

    def _build_causal_traces(
        self,
        task_tensor: CooperativeContextTensor,
        selected_team: List[CooperativeIntelligenceVector],
        contributions: List[MarginalInfluenceContribution],
    ) -> List[AgentSelectionTrace]:
        contribution_map = {item.agent_id: item for item in contributions}
        traces: List[AgentSelectionTrace] = []

        for agent in selected_team:
            alignment = MatchingEngine.score_agent_alignment(task_tensor, agent)
            contribution = contribution_map[agent.agent_id]
            top_links = self._top_complementarity_links(agent, selected_team, task_tensor)

            explanation = [
                (
                    "High alignment with the task capability tensor and "
                    f"causal depth requirements (score={alignment:.4f})."
                ),
                (
                    "Removal impact indicates projected team performance loss "
                    f"of {abs(contribution.removal_delta_total_impact):.4f}."
                ),
                (
                    "Structural necessity remained significant at "
                    f"{contribution.structural_necessity_score:.4f}."
                ),
            ]
            if top_links:
                first_link = top_links[0]
                explanation.append(
                    "Complementarity trace shows reinforcing cooperation with "
                    f"{first_link[0]} (score={first_link[1]:.4f})."
                )

            traces.append(
                AgentSelectionTrace(
                    agent_id=agent.agent_id,
                    alignment_score=alignment,
                    structural_necessity_score=contribution.structural_necessity_score,
                    removal_impact_gap=abs(contribution.removal_delta_total_impact),
                    top_complementarity_links=top_links,
                    causal_explanation=explanation,
                )
            )

        return sorted(traces, key=lambda item: item.removal_impact_gap, reverse=True)

    def _top_complementarity_links(
        self,
        focal_agent: CooperativeIntelligenceVector,
        selected_team: List[CooperativeIntelligenceVector],
        task_tensor: CooperativeContextTensor,
    ) -> List[Tuple[str, float]]:
        links: List[Tuple[str, float]] = []
        focal_alignment = self.context_model.compute_alignment_score(task_tensor, focal_agent.capability_profile)

        for other in selected_team:
            if other.agent_id == focal_agent.agent_id:
                continue
            other_alignment = self.context_model.compute_alignment_score(task_tensor, other.capability_profile)
            combined = 0.5 * (focal_alignment + other_alignment)
            links.append((other.agent_id, round(combined, 6)))

        links.sort(key=lambda item: item[1], reverse=True)
        return links[:2]
