/**
 * AgentCoordinationMessage Schema
 * Version: 1.0.0
 * 
 * This schema defines the universal structure for agent-to-agent coordination,
 * negotiation, and commitment. It is designed to be extensible, auditable,
 * and environment-agnostic.
 */

/**
 * Valid message types for the coordination protocol.
 */
export enum MessageType {
  OFFER = 'OFFER',              // Initial proposal for collaboration
  COUNTEROFFER = 'COUNTEROFFER', // Negotiation step with modified terms
  ACCEPTANCE = 'ACCEPTANCE',     // Formal agreement to the terms
  REJECTION = 'REJECTION',       // Formal refusal of the terms
  COMMITMENT = 'COMMITMENT'      // Final execution-ready binding agreement
}

/**
 * Cryptographic identity of an agent.
 */
export interface AgentIdentity {
  id: string;                   // Unique agent identifier (e.g., UUID or DID)
  publicKey: string;            // Public key for verification
  signature?: string;           // Cryptographic signature of the message content
  algorithm: string;            // Signature algorithm (e.g., 'Ed25519', 'RSASSA-PSS')
}

/**
 * Detailed scope of work for the proposed collaboration.
 */
export interface ScopeOfWork {
  tasks: string[];              // List of specific tasks to be performed
  deliverables: string[];       // Expected outcomes or objects
  milestones: {
    description: string;
    deadline: string;           // ISO 8601 timestamp
  }[];
  constraints: string[];        // Technical or policy restrictions
}

/**
 * Resource requirements and allocations for the tasks.
 */
export interface ResourceAllocation {
  budget: {
    amount: number;
    currency: string;           // e.g., 'USD', 'ETH', 'STAKE'
    limit: number;              // Maximum allowable spend
  };
  compute?: {
    type: string;               // e.g., 'GPU', 'CPU'
    allocation: string;         // e.g., '100 TFLOPS'
  };
  storage?: {
    size: string;               // e.g., '1TB'
    durability: string;
  };
}

/**
 * Disclosure of potential risks and mitigation strategies.
 */
export interface RiskDisclosure {
  riskScore: number;            // Normalized risk (0.0 to 1.0)
  identifiedRisks: {
    type: string;
    probability: number;
    impact: number;
    mitigation: string;
  }[];
}

/**
 * Predicted economic impact of the collaboration.
 */
export interface EconomicImpact {
  predictedRoi: number;         // Percentage or multiplier
  estimatedCost: number;
  netValue: number;
  synergyScore: number;         // Multi-agent cooperation value
}

/**
 * Top-level Agent Coordination Message.
 */
export interface AgentCoordinationMessage {
  version: string;              // Schema version (e.g., '1.0.0')
  messageId: string;            // Unique message identifier
  correlationId?: string;       // ID linking related messages (negotiation chain)
  timestamp: string;            // ISO 8601 creation time
  type: MessageType;
  
  sender: AgentIdentity;
  recipient: AgentIdentity;
  
  content: {
    scope: ScopeOfWork;
    resources: ResourceAllocation;
    deadline: string;           // Overall project deadline
    risks: RiskDisclosure;
    impact: EconomicImpact;
  };
  
  /**
   * Extensibility field for environment-specific or future properties.
   */
  metadata?: Record<string, any>;
}

/**
 * JSON Schema Representation (for cross-language compatibility)
 */
export const MESSAGE_JSON_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AgentCoordinationMessage",
  "type": "object",
  "required": ["version", "messageId", "timestamp", "type", "sender", "recipient", "content"],
  "properties": {
    "version": { "type": "string" },
    "messageId": { "type": "string" },
    "correlationId": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "type": { "enum": ["OFFER", "COUNTEROFFER", "ACCEPTANCE", "REJECTION", "COMMITMENT"] },
    "sender": { "$ref": "#/definitions/AgentIdentity" },
    "recipient": { "$ref": "#/definitions/AgentIdentity" },
    "content": {
      "type": "object",
      "required": ["scope", "resources", "deadline", "risks", "impact"],
      "properties": {
        "scope": { "$ref": "#/definitions/ScopeOfWork" },
        "resources": { "$ref": "#/definitions/ResourceAllocation" },
        "deadline": { "type": "string", "format": "date-time" },
        "risks": { "$ref": "#/definitions/RiskDisclosure" },
        "impact": { "$ref": "#/definitions/EconomicImpact" }
      }
    },
    "metadata": { "type": "object", "additionalProperties": true }
  },
  "definitions": {
    "AgentIdentity": {
      "type": "object",
      "required": ["id", "publicKey", "algorithm"],
      "properties": {
        "id": { "type": "string" },
        "publicKey": { "type": "string" },
        "signature": { "type": "string" },
        "algorithm": { "type": "string" }
      }
    },
    "ScopeOfWork": {
      "type": "object",
      "required": ["tasks", "deliverables", "milestones"],
      "properties": {
        "tasks": { "type": "array", "items": { "type": "string" } },
        "deliverables": { "type": "array", "items": { "type": "string" } },
        "milestones": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["description", "deadline"],
            "properties": {
              "description": { "type": "string" },
              "deadline": { "type": "string", "format": "date-time" }
            }
          }
        },
        "constraints": { "type": "array", "items": { "type": "string" } }
      }
    },
    "ResourceAllocation": {
      "type": "object",
      "required": ["budget"],
      "properties": {
        "budget": {
          "type": "object",
          "required": ["amount", "currency", "limit"],
          "properties": {
            "amount": { "type": "number" },
            "currency": { "type": "string" },
            "limit": { "type": "number" }
          }
        },
        "compute": {
          "type": "object",
          "properties": {
            "type": { "type": "string" },
            "allocation": { "type": "string" }
          }
        },
        "storage": {
          "type": "object",
          "properties": {
            "size": { "type": "string" },
            "durability": { "type": "string" }
          }
        }
      }
    },
    "RiskDisclosure": {
      "type": "object",
      "required": ["riskScore", "identifiedRisks"],
      "properties": {
        "riskScore": { "type": "number", "minimum": 0, "maximum": 1 },
        "identifiedRisks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": { "type": "string" },
              "probability": { "type": "number" },
              "impact": { "type": "number" },
              "mitigation": { "type": "string" }
            }
          }
        }
      }
    },
    "EconomicImpact": {
      "type": "object",
      "required": ["predictedRoi", "estimatedCost", "netValue", "synergyScore"],
      "properties": {
        "predictedRoi": { "type": "number" },
        "estimatedCost": { "type": "number" },
        "netValue": { "type": "number" },
        "synergyScore": { "type": "number" }
      }
    }
  }
};
