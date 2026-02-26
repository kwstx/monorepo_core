from __future__ import annotations

from typing import Type, TypeVar

from pydantic import BaseModel

from autonomy_core.schemas.models import (
    ActionAuthorizationRequest,
    ActionAuthorizationResponse,
    AgentRegistrationRequest,
    AgentRegistrationResponse,
    BudgetEvaluationRequest,
    BudgetEvaluationResponse,
    GovernanceProposalRequest,
    GovernanceProposalResponse,
    ScoringResult,
    SimulationRequest,
    SimulationResponse,
    VerificationResult,
)


ModelT = TypeVar("ModelT", bound=BaseModel)


def _assert_structured_response(value: object, model: Type[ModelT]) -> ModelT:
    assert not isinstance(value, dict)
    assert isinstance(value, BaseModel)
    assert isinstance(value, model)
    return value


async def test_unified_runtime_stack_end_to_end(core, state_store) -> None:
    # Ensure every subsystem shares the same in-memory state backend.
    assert getattr(core.identity, "state_store", None) is state_store
    assert getattr(core.enforcement, "state_store", None) is state_store
    assert getattr(core.economic, "state_store", None) is state_store
    assert getattr(core.coordination, "state_store", None) is state_store
    assert getattr(core.scoring, "state_store", None) is state_store
    assert getattr(core.simulation, "state_store", None) is state_store
    assert getattr(core.governance, "state_store", None) is state_store

    agent_id = "integration_agent_001"

    # 1) Register agent.
    reg_req = AgentRegistrationRequest(agent_id=agent_id, attributes={"role": "validator", "tier": "A"})
    reg_res = await core.identity.register(reg_req)
    reg_res = _assert_structured_response(reg_res, AgentRegistrationResponse)
    assert reg_res.success is True
    assert reg_res.agent_id == agent_id

    verify_res = await core.identity.verify(agent_id)
    verify_res = _assert_structured_response(verify_res, VerificationResult)
    assert verify_res.is_valid is True

    # 2) Trigger economic evaluation explicitly.
    eco_req = BudgetEvaluationRequest(agent_id=agent_id, action_type="execute_defi_trade", payload={"amount": 10.5})
    eco_res = await core.economic.has_funds(eco_req)
    eco_res = _assert_structured_response(eco_res, BudgetEvaluationResponse)
    assert eco_res.has_funds is True
    assert isinstance(eco_res.balance, float)

    # 3) Run a risk simulation explicitly.
    sim_req = SimulationRequest(agent_id=agent_id, action_type="execute_defi_trade", payload={"pair": "ETH/USDC"})
    sim_res = await core.simulation.predict_impact(sim_req)
    sim_res = _assert_structured_response(sim_res, SimulationResponse)
    assert 0.0 <= sim_res.impact_score <= 1.0

    # 4) Validate scoring outcome explicitly.
    action_req = ActionAuthorizationRequest(
        agent_id=agent_id,
        action_id="integration_action_001",
        action_type="execute_defi_trade",
        payload={"pair": "ETH/USDC", "amount": 10.5, "slippage": 0.01},
    )
    score_res = await core.scoring.calculate_score(action_req, sim_res.impact_score)
    score_res = _assert_structured_response(score_res, ScoringResult)
    assert score_res.action_score == 0.8 + sim_res.impact_score
    assert score_res.threshold_met is True

    # 5) Simulate a governance proposal explicitly.
    gov_req = GovernanceProposalRequest(proposer_id=agent_id, changes={"risk_thresholds.minimum_action_score": 0.0})
    gov_res = await core.governance.submit_proposal(gov_req)
    gov_res = _assert_structured_response(gov_res, GovernanceProposalResponse)
    assert gov_res.accepted is True
    assert gov_res.proposal_id is not None

    # 6) Perform an end-to-end authorization request (exercises the full runtime).
    auth_res = await core.authorize_action(action_req)
    auth_res = _assert_structured_response(auth_res, ActionAuthorizationResponse)
    assert auth_res.is_authorized is True
    assert auth_res.reason == "Success"

    # Validate that the full stack persisted state in the in-memory store.
    assert agent_id in state_store.agents
    assert len(state_store.proposals) >= 1
    assert len(state_store.decisions) >= 1

    audit_events = await state_store.get_audit_events()
    event_types = {evt.get("type") for evt in audit_events}
    assert "enforcement_validation" in event_types
    assert "economic_check" in event_types
    assert "simulation" in event_types
    assert "score_calculation" in event_types
    assert "coordination_broadcast" in event_types

