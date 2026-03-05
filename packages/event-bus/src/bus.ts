import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';

export interface EventMessage {
    correlationId: string;
    timestamp: string;
    payload: any;
    sender: string;
}

export enum EventTopic {
    ACTION_REQUESTED = 'action.requested',
    IDENTITY_VERIFIED = 'identity.verified',
    IDENTITY_REJECTED = 'identity.rejected',
    ENFORCEMENT_RESULT = 'enforcement.result', // Payload includes status: PERMITTED | BLOCKED
    SIMULATION_COMPLETED = 'simulation.completed',
    SAFETY_LOOP_RESULT = 'safety_loop.result'
}

export class EventBus {
    private client: RedisClientType;
    private subscriber: RedisClientType;
    private isConnected: boolean = false;

    constructor(redisUrl: string = 'redis://localhost:6379') {
        this.client = createClient({ url: redisUrl });
        this.subscriber = createClient({ url: redisUrl });
    }

    async connect() {
        if (this.isConnected) return;
        await Promise.all([
            this.client.connect(),
            this.subscriber.connect()
        ]);
        this.isConnected = true;
        console.log('[EventBus] Connected to Redis');
    }

    async publish(topic: EventTopic, payload: any, correlationId?: string, sender: string = 'unknown'): Promise<string> {
        const message: EventMessage = {
            correlationId: correlationId || uuidv4(),
            timestamp: new Date().toISOString(),
            payload,
            sender
        };

        await this.client.publish(topic, JSON.stringify(message));
        return message.correlationId;
    }

    async subscribe(topic: EventTopic, callback: (message: EventMessage) => void | Promise<void>) {
        await this.subscriber.subscribe(topic, (messageStr) => {
            try {
                const message = JSON.parse(messageStr) as EventMessage;
                callback(message);
            } catch (err) {
                console.error(`[EventBus] Error parsing message from topic ${topic}:`, err);
            }
        });
        console.log(`[EventBus] Subscribed to topic ${topic}`);
    }

    async disconnect() {
        await Promise.all([
            this.client.disconnect(),
            this.subscriber.disconnect()
        ]);
        this.isConnected = false;
    }
}
