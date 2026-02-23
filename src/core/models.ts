export enum EnforcementState {
  PENDING = 'PENDING',
  PRE_EXECUTION_PASSED = 'PRE_EXECUTION_PASSED',
  PRE_EXECUTION_FAILED = 'PRE_EXECUTION_FAILED',
  EXECUTING = 'EXECUTING',
  SUSPENDED = 'SUSPENDED',
  COMPLETED = 'COMPLETED',
  REMEDIATED = 'REMEDIATED',
  AUDIT_PASSED = 'AUDIT_PASSED',
  AUDIT_FAILED = 'AUDIT_FAILED'
}

export enum ViolationSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ViolationCategory {
  PERMISSION = 'PERMISSION',
  SCOPE = 'SCOPE',
  IMPACT = 'IMPACT',
  ANOMALY = 'ANOMALY',
  COMPLIANCE = 'COMPLIANCE'
}

export interface Violation {
  id: string;
  timestamp: Date;
  category: ViolationCategory;
  severity: ViolationSeverity;
  description: string;
  sourceLayer: string;
  metadata: Record<string, any>;
}

export interface ActionContext {
  actionId: string;
  agentId: string;
  intent: string;
  params: Record<string, any>;
  startTime?: Date;
  endTime?: Date;
  status: EnforcementState;
  violations: Violation[];
}
