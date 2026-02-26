import { PnLTracker } from './PnLTracker.js';
import { TreasuryEngine } from './TreasuryEngine.js';
async function runTreasuryDemo() {
    console.log('--- Treasury Engine & Cooperative Pooling Demo ---');
    // 1. Setup PnLTracker and TreasuryEngine
    const pnlTracker = new PnLTracker({ hmacSecret: 'treasury-demo-secret' });
    const treasuryEngine = new TreasuryEngine(pnlTracker, {
        rewardScalingMultiplier: 2.0 // Aggressive scaling for high cooperation
    });
    // 2. Setup Agents with Budgets
    const agentAlphaBudget = {
        id: 'b-alpha',
        agentId: 'agent-alpha',
        allocations: [{ resourceType: 'monetary', totalBudget: 5000, spentBudget: 4200, pendingAllocations: 0, unit: 'USD' }],
        temporalConstraints: { startDate: new Date(), renewalPeriod: 'monthly' },
        revisionHistory: [],
        status: 'active',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const agentBetaBudget = {
        id: 'b-beta',
        agentId: 'agent-beta',
        allocations: [{ resourceType: 'monetary', totalBudget: 3000, spentBudget: 1500, pendingAllocations: 0, unit: 'USD' }],
        temporalConstraints: { startDate: new Date(), renewalPeriod: 'monthly' },
        revisionHistory: [],
        status: 'active',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const agentGammaBudget = {
        id: 'b-gamma',
        agentId: 'agent-gamma',
        allocations: [{ resourceType: 'monetary', totalBudget: 2000, spentBudget: 1800, pendingAllocations: 0, unit: 'USD' }],
        temporalConstraints: { startDate: new Date(), renewalPeriod: 'monthly' },
        revisionHistory: [],
        status: 'active',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };
    // 3. Create a Shared Treasury Pool
    console.log('\nCreating Shared Treasury Pool: "Quantum Synergy Pool"');
    const pool = treasuryEngine.createPool('pool-001', 'Quantum Synergy Pool', 'monetary', 'USD');
    // 4. Proportional Contributions from Unused Budgets
    console.log('\n--- Scenario: Contributing Unused Budgets ---');
    // Alpha has 800 left, contributes 50%
    const contribAlpha = treasuryEngine.contributeFromUnused(agentAlphaBudget, pool.id, 0.5);
    console.log(`Agent Alpha contributed: $${contribAlpha} (Unused remaining: $${agentAlphaBudget.allocations[0].totalBudget - agentAlphaBudget.allocations[0].spentBudget})`);
    // Beta has 1500 left, contributes 80%
    const contribBeta = treasuryEngine.contributeFromUnused(agentBetaBudget, pool.id, 0.8);
    console.log(`Agent Beta contributed: $${contribBeta} (Unused remaining: $${agentBetaBudget.allocations[0].totalBudget - agentBetaBudget.allocations[0].spentBudget})`);
    // Gamma has 200 left, contributes 10%
    const contribGamma = treasuryEngine.contributeFromUnused(agentGammaBudget, pool.id, 0.1);
    console.log(`Agent Gamma contributed: $${contribGamma} (Unused remaining: $${agentGammaBudget.allocations[0].totalBudget - agentGammaBudget.allocations[0].spentBudget})`);
    console.log(`Total Pool Funds: $${pool.totalAmount}`);
    // 5. Propose Joint Projects
    console.log('\n--- Scenario: Proposing Joint Projects ---');
    const projectA = {
        id: 'proj-A',
        name: 'Shared Compute Cluster',
        description: 'Joint infrastructure for high-latency tasks',
        estimatedROI: 1.8, // 80% return
        requiredFunding: 1000,
        currentFunding: 0,
        involvedAgents: ['agent-alpha', 'agent-beta'],
        cooperationFactor: 1.2,
        status: 'funding'
    };
    const projectB = {
        id: 'proj-B',
        name: 'Cooperative Knowledge Graph',
        description: 'Cross-agent data sharing and synthesis',
        estimatedROI: 3.5, // 250% return
        requiredFunding: 1200,
        currentFunding: 0,
        involvedAgents: ['agent-alpha', 'agent-beta', 'agent-gamma'],
        cooperationFactor: 4.5, // High synergy
        status: 'funding'
    };
    treasuryEngine.proposeProject(projectA);
    treasuryEngine.proposeProject(projectB);
    console.log(`Proposed Projects: ${projectA.name} (ROI: ${projectA.estimatedROI}), ${projectB.name} (ROI: ${projectB.estimatedROI}, Coop: ${projectB.cooperationFactor})`);
    // 6. Allocate Pool Funds (ROI-Weighted)
    console.log('\n--- Scenario: Allocating ROI-Weighted Funding ---');
    const funded = treasuryEngine.allocatePoolFunds(pool.id);
    console.log(`Projects receiving funding: ${funded.join(', ')}`);
    console.log(`Project A Funding: $${projectA.currentFunding}/${projectA.requiredFunding} (Status: ${projectA.status})`);
    console.log(`Project B Funding: $${projectB.currentFunding}/${projectB.requiredFunding} (Status: ${projectB.status})`);
    console.log(`Remaining Pool Funds: $${pool.totalAmount}`);
    // 7. Complete and Reconcile with Reward Scaling
    console.log('\n--- Scenario: Project Completion & Reward Scaling ---');
    // Project B was highly cooperative, let's see the scaling
    const originalGain = 2000;
    console.log(`Project B completed with base gain: $${originalGain}`);
    treasuryEngine.reconcileProject(projectB.id, originalGain);
    // 8. Transparency & Accountability (PnLTracker Ledger)
    console.log('\n--- Transparency Audit: PnLTracker Ledger ---');
    const ledger = pnlTracker.getLedger();
    // Filter for interesting entries
    const contributions = ledger.filter(e => e.actionType === 'pool_contribution');
    const allocations = ledger.filter(e => e.actionType === 'pool_allocation');
    const rewards = ledger.filter(e => e.actionType === 'joint_project_reward');
    console.log('\n[Contributions]');
    contributions.forEach(e => console.log(` - Agent ${e.agentId} contributed $${e.directCosts} (Hash: ${e.payloadHash.slice(0, 8)})`));
    console.log('\n[Allocations]');
    allocations.forEach(e => console.log(` - Allocated $${e.directCosts} to ${e.metadata.projectId} (ROI Weight applied)`));
    console.log('\n[Scaled Rewards]');
    rewards.forEach(e => {
        console.log(` - Agent ${e.agentId} received $${e.revenue.toFixed(2)} (Scaled from $${(Number(e.metadata.originalGain)).toFixed(2)})`);
    });
    console.log('\nLedger Verification:', pnlTracker.verifyLedger().valid ? 'PASSED (Cryptographically Secure)' : 'FAILED');
}
runTreasuryDemo().catch(console.error);
//# sourceMappingURL=treasury_demo.js.map