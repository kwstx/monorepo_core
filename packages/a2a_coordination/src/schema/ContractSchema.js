"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractFactory = void 0;
const ImmutableAuditLog_1 = require("../audit/ImmutableAuditLog");
/**
 * Factory for creating immutable SharedTaskContract objects.
 */
class ContractFactory {
    static appendAuditEvent(contract, event) {
        const auditLog = new ImmutableAuditLog_1.ImmutableAuditLog(contract.immutableAuditLog);
        auditLog.record(event);
        return auditLog.toSnapshot();
    }
    /**
     * Creates a new contract and freezes it to prevent modifications.
     */
    static createContract(data) {
        const createdAt = data.createdAt || new Date().toISOString();
        const contract = {
            contractId: data.contractId || `cnt-${Math.random().toString(36).substr(2, 9)}`,
            version: '1.0.0',
            correlationId: data.correlationId || '',
            scope: data.scope || { tasks: [], deliverables: [], milestones: [], constraints: [] },
            deliverables: data.deliverables || [],
            deadlines: data.deadlines || { overallCompletion: '', milestones: [] },
            compensation: data.compensation || { budget: { amount: 0, currency: 'USD', limit: 0 } },
            penaltyClauses: data.penaltyClauses || [],
            rollbackConditions: data.rollbackConditions || [],
            auditReferences: data.auditReferences || [],
            immutableAuditLog: data.immutableAuditLog || { events: [], headHash: 'GENESIS' },
            participatingAgents: data.participatingAgents || [],
            signatures: data.signatures || [],
            status: data.status || 'DRAFT',
            createdAt,
            updatedAt: data.updatedAt || new Date().toISOString(),
        };
        const immutableAuditLog = this.appendAuditEvent(contract, {
            domain: 'CONTRACT',
            action: 'CONTRACT_CREATED',
            outcome: 'SUCCESS',
            contractId: contract.contractId,
            correlationId: contract.correlationId,
            details: {
                status: contract.status,
                createdAt
            }
        });
        return Object.freeze({
            ...contract,
            immutableAuditLog
        });
    }
    /**
     * Signs a contract. Since the contract is immutable, this returns a new signed instance.
     */
    static signContract(contract, agent, signature) {
        if (contract.status !== 'DRAFT' && contract.status !== 'SIGNED') {
            throw new Error(`Cannot sign contract in status: ${contract.status}`);
        }
        const newSignature = {
            agentId: agent.id,
            publicKey: agent.publicKey,
            signature: signature,
            timestamp: new Date().toISOString(),
            algorithm: agent.algorithm
        };
        const updatedSignatures = [...contract.signatures, newSignature];
        const allSigned = contract.participatingAgents.every(id => updatedSignatures.some(s => s.agentId === id));
        const newContract = {
            ...contract,
            signatures: updatedSignatures,
            status: allSigned ? 'SIGNED' : 'SIGNED',
            immutableAuditLog: this.appendAuditEvent(contract, {
                domain: 'APPROVAL',
                action: 'CONTRACT_SIGNED',
                outcome: 'SUCCESS',
                contractId: contract.contractId,
                correlationId: contract.correlationId,
                actorId: agent.id,
                details: {
                    signatureAlgorithm: agent.algorithm,
                    signatureCount: updatedSignatures.length,
                    requiredSignatures: contract.participatingAgents.length
                }
            }),
            updatedAt: new Date().toISOString()
        };
        return Object.freeze(newContract);
    }
    /**
     * Commits the contract, making it final and ready for execution.
     */
    static commit(contract) {
        if (contract.signatures.length < contract.participatingAgents.length) {
            throw new Error('All participating agents must sign before commitment.');
        }
        const committedContract = {
            ...contract,
            status: 'ACTIVE',
            immutableAuditLog: this.appendAuditEvent(contract, {
                domain: 'APPROVAL',
                action: 'CONTRACT_COMMITTED',
                outcome: 'SUCCESS',
                contractId: contract.contractId,
                correlationId: contract.correlationId,
                details: {
                    signatures: contract.signatures.length
                }
            }),
            updatedAt: new Date().toISOString()
        };
        return Object.freeze(committedContract);
    }
    /**
     * Records an explicit rejection and closes the contract.
     */
    static reject(contract, actorId, reason) {
        if (contract.status === 'COMPLETED') {
            throw new Error('Cannot reject a completed contract.');
        }
        const rejectedContract = {
            ...contract,
            status: 'TERMINATED',
            immutableAuditLog: this.appendAuditEvent(contract, {
                domain: 'REJECTION',
                action: 'CONTRACT_REJECTED',
                outcome: 'FAILURE',
                contractId: contract.contractId,
                correlationId: contract.correlationId,
                actorId,
                details: { reason }
            }),
            updatedAt: new Date().toISOString()
        };
        return Object.freeze(rejectedContract);
    }
    /**
     * Records execution outcome and moves the contract to completion.
     */
    static complete(contract, actorId, outcome) {
        if (contract.status !== 'ACTIVE') {
            throw new Error(`Only ACTIVE contracts can be completed. Current status: ${contract.status}`);
        }
        const status = outcome.success ? 'COMPLETED' : 'ROLLED_BACK';
        const completedContract = {
            ...contract,
            status,
            immutableAuditLog: this.appendAuditEvent(contract, {
                domain: 'EXECUTION',
                action: 'CONTRACT_EXECUTION_OUTCOME',
                outcome: outcome.success ? 'SUCCESS' : 'FAILURE',
                contractId: contract.contractId,
                correlationId: contract.correlationId,
                actorId,
                details: {
                    summary: outcome.summary,
                    evidence: outcome.evidence ?? [],
                    finalStatus: status
                }
            }),
            updatedAt: new Date().toISOString()
        };
        return Object.freeze(completedContract);
    }
    static getAuditTrail(contract) {
        return contract.immutableAuditLog.events;
    }
    static verifyAuditTrail(contract) {
        const auditLog = new ImmutableAuditLog_1.ImmutableAuditLog(contract.immutableAuditLog);
        return auditLog.verifyIntegrity();
    }
}
exports.ContractFactory = ContractFactory;
