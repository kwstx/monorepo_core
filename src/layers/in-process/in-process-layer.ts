import { BaseEnforcementLayer } from '../base-layer';
import { ActionContext, EnforcementState, ViolationCategory, ViolationSeverity } from '../../core/models';
import { EnforcementEvents } from '../../core/event-bus';

export class InProcessLayer extends BaseEnforcementLayer {
    getName(): string {
        return 'InProcessMonitoring';
    }

    async process(context: ActionContext): Promise<ActionContext> {
        if (context.status !== EnforcementState.PRE_EXECUTION_PASSED) {
            return context;
        }

        context.status = EnforcementState.EXECUTING;
        this.eventBus.emit(EnforcementEvents.ACTION_EXECUTING, context);

        console.log(`[${this.getName()}] Monitoring action: ${context.actionId}`);

        // Simulate real-time monitoring
        // In a real scenario, this might be called multiple times or listen to events
        if (context.params.resourceUsage > 100) {
            const violation = {
                id: `v-proc-${Date.now()}`,
                timestamp: new Date(),
                category: ViolationCategory.IMPACT,
                severity: ViolationSeverity.MEDIUM,
                description: 'Excessive resource usage detected during execution.',
                sourceLayer: this.getName(),
                metadata: { resourceUsage: context.params.resourceUsage }
            };

            context.violations.push(violation);
            this.eventBus.emitViolation(context.actionId, violation);

            // We might choose to suspend if it's high severity
            if (violation.severity === ViolationSeverity.CRITICAL) {
                context.status = EnforcementState.SUSPENDED;
            }
        }

        return context;
    }
}
