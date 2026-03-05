import redis.asyncio as redis
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, Callable, Awaitable
import asyncio
from enum import Enum

class EventTopic(str, Enum):
    ACTION_REQUESTED = 'action.requested'
    IDENTITY_VERIFIED = 'identity.verified'
    IDENTITY_REJECTED = 'identity.rejected'
    ENFORCEMENT_RESULT = 'enforcement.result' # Payload includes status: PERMITTED | BLOCKED
    SIMULATION_COMPLETED = 'simulation.completed'
    SAFETY_LOOP_RESULT = 'safety_loop.result'

class EventMessage:
    def __init__(self, correlationId: str, timestamp: str, payload: Any, sender: str):
        self.correlationId = correlationId
        self.timestamp = timestamp
        self.payload = payload
        self.sender = sender

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        return cls(
            correlationId=data.get('correlationId', str(uuid.uuid4())),
            timestamp=data.get('timestamp', datetime.now().isoformat()),
            payload=data.get('payload'),
            sender=data.get('sender', 'unknown')
        )

    def to_dict(self):
        return {
            'correlationId': self.correlationId,
            'timestamp': self.timestamp,
            'payload': self.payload,
            'sender': self.sender
        }

class EventBus:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.client: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
        self.is_connected = False
        self._listen_task: Optional[asyncio.Task] = None
        self._handlers: Dict[EventTopic, list[Callable[[EventMessage], Awaitable[None]]]] = {}

    async def connect(self):
        if self.is_connected: return
        self.client = redis.from_url(self.redis_url, decode_responses=True)
        self.pubsub = self.client.pubsub()
        self.is_connected = True
        self._listen_task = asyncio.create_task(self._listen())
        print("[EventBus] Connected to Redis")

    async def publish(self, topic: EventTopic, payload: Any, correlation_id: Optional[str] = None, sender: str = 'unknown') -> str:
        if not self.is_connected: await self.connect()
        corr_id = correlation_id or str(uuid.uuid4())
        message = EventMessage(
            correlationId=corr_id,
            timestamp=datetime.now().isoformat(),
            payload=payload,
            sender=sender
        )
        await self.client.publish(topic.value, json.dumps(message.to_dict()))
        return corr_id

    async def subscribe(self, topic: EventTopic, callback: Callable[[EventMessage], Awaitable[None]]):
        if not self.is_connected: await self.connect()
        if topic not in self._handlers:
            self._handlers[topic] = []
            await self.pubsub.subscribe(topic.value)
        self._handlers[topic].append(callback)
        print(f"[EventBus] Subscribed to topic {topic.value}")

    async def _listen(self):
        try:
            async for message in self.pubsub.listen():
                if message['type'] == 'message':
                    data = json.loads(message['data'])
                    event_msg = EventMessage.from_dict(data)
                    topic = EventTopic(message['channel'])
                    if topic in self._handlers:
                        for handler in self._handlers[topic]:
                            asyncio.create_task(handler(event_msg))
        except Exception as e:
            if self.is_connected:
                print(f"[EventBus] Error in listen loop: {e}")

    async def disconnect(self):
        self.is_connected = False
        if self._listen_task:
            self._listen_task.cancel()
        if self.pubsub:
            await self.pubsub.close()
        if self.client:
            await self.client.close()
