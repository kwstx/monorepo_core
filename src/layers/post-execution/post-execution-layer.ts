import { BaseEnforcementLayer } from '../base-layer';
import { ActionContext, EnforcementState, ViolationCategory, ViolationSeverity } from '../../core/models';
import { EnforcementEvents } from '../../core/event-bus';

export class PostExecutionLayer extends BaseEnforcementLayer {
    getName(): string {
        return 'PostExecutionAuditing';
    }

    async process(context: ActionContext): Promise<ActionContext> {
        this.eventBus.emit(EnforcementEvents.AUDIT_STARTED, context);

        console.log(`[${this.getName()}] Auditing results for action: ${context.actionId}`);

        // Simulate auditing logic
        const hasCriticalViolation = context.violations.some(v => v.severity === ViolationSeverity.CRITICAL);

        if (hasCriticalViolation || context.params.invalidResult) {
            const violation = {
                id: `v-post-${Date.now()}`,
                timestamp: new Date(),
                category: ViolationCategory.COMPLIANCE,
                severity: ViolationSeverity.CRITICAL,
                description: 'Final result fails compliance audit.',
                sourceLayer: this.getName(),
                metadata: { invalidResult: context.params.invalidResult }
            };

            context.violations.push(violation);
            context.status = EnforcementState.AUDIT_FAILED;
            this.eventBus.emitViolation(context.actionId, violation);

            // Auto-remediation trigger
            this.triggerRemediation(context);
        } else {
            context.status = EnforcementState.AUDIT_PASSED;
        }

        this.eventBus.emit(EnforcementEvents.AUDIT_COMPLETED, context);
        return context;
    }

    private triggerRemediation(context: ActionContext) {
        console.log(`[${this.getName()}] Starting automatic remediation for violation...`);
        context.status = EnforcementState.REMEDIATED;
        this.eventBus.emit(EnforcementEvents.REMEDIATION_TRIGGERED, context);
    }
}
