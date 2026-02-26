"use strict";
/**
 * AgentCoordinationMessage Schema
 * Version: 1.0.0
 *
 * This schema defines the universal structure for agent-to-agent coordination,
 * negotiation, and commitment. It is designed to be extensible, auditable,
 * and environment-agnostic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_JSON_SCHEMA = exports.MessageType = void 0;
/**
 * Valid message types for the coordination protocol.
 */
var MessageType;
(function (MessageType) {
    MessageType["OFFER"] = "OFFER";
    MessageType["COUNTEROFFER"] = "COUNTEROFFER";
    MessageType["ACCEPTANCE"] = "ACCEPTANCE";
    MessageType["REJECTION"] = "REJECTION";
    MessageType["COMMITMENT"] = "COMMITMENT"; // Final execution-ready binding agreement
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * JSON Schema Representation (for cross-language compatibility)
 */
exports.MESSAGE_JSON_SCHEMA = {
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
