import { BaseEnforcementLayer } from '../base-layer';
import { ActionContext, EnforcementState, ViolationCategory, ViolationSeverity } from '../../core/models';
import { EnforcementEvents } from '../../core/event-bus';

export class PreExecutionLayer extends BaseEnforcementLayer {
    getName(): string {
        return 'PreExecutionValidation';
    }

    async process(context: ActionContext): Promise<ActionContext> {
        this.eventBus.emit(EnforcementEvents.PRE_EXECUTION_STARTED, context);

        console.log(`[${this.getName()}] Validating intent: ${context.intent}`);

        // Simulate validation logic
        if (context.params.unauthorized) {
            const violation = {
                id: `v-pre-${Date.now()}`,
                timestamp: new Date(),
                category: ViolationCategory.PERMISSION,
                severity: ViolationSeverity.HIGH,
                description: 'Unauthorized parameter detected in pre-execution.',
                sourceLayer: this.getName(),
                metadata: { param: 'unauthorized' }
            };

            context.violations.push(violation);
            context.status = EnforcementState.PRE_EXECUTION_FAILED;
            this.eventBus.emitViolation(context.actionId, violation);
        } else {
            context.status = EnforcementState.PRE_EXECUTION_PASSED;
        }

        this.eventBus.emit(EnforcementEvents.PRE_EXECUTION_COMPLETED, context);
        return context;
    }
}
