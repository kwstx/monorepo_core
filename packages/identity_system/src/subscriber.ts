import { EventBus, EventTopic, EventMessage } from '@agent-infra/event-bus';
import { IdentityAuthorityAPI } from './IdentityAuthorityAPI';

async function main() {
    const bus = new EventBus();
    const identityApi = new IdentityAuthorityAPI();

    await bus.connect();
    console.log('[IdentityService] Connected to Event Bus');

    await bus.subscribe(EventTopic.ACTION_REQUESTED, async (msg: EventMessage) => {
        console.log(`[IdentityService] Verifying identity for: ${msg.correlationId}`);

        const { agent_id } = msg.payload;

        // Perform verification logic
        try {
            // For demo, assume it's valid if starts with 'Agent'
            const isValid = agent_id.startsWith('Agent') || agent_id === 'test-agent';

            if (isValid) {
                console.log(`[IdentityService] Identity verified: ${agent_id}`);
                // Complete Chain: Pass the full payload to the next step
                await bus.publish(
                    EventTopic.IDENTITY_VERIFIED,
                    msg.payload,
                    msg.correlationId,
                    'identity_service'
                );
            } else {
                console.warn(`[IdentityService] Identity rejected: ${agent_id}`);
                await bus.publish(
                    EventTopic.SAFETY_LOOP_RESULT,
                    { status: 'DENIED', reason: 'Invalid agent identity' },
                    msg.correlationId,
                    'identity_service'
                );
            }
        } catch (err) {
            console.error(`[IdentityService] Error:`, err);
        }
    });

    // Also keeps running
    process.on('SIGINT', async () => {
        await bus.disconnect();
        process.exit(0);
    });
}

main().catch(console.error);
