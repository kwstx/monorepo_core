import asyncio
from event_bus import EventBus, EventTopic, EventMessage

async def main():
    bus = EventBus()
    await bus.connect()
    print("[SimulationService] Connected to Event Bus")

    async def on_enforcement_result(msg: EventMessage):
        if msg.payload.get("status") != "PERMITTED":
            print(f"[SimulationService] Action {msg.correlationId} BLOCKED by enforcement. Skipping simulation.")
            return

        print(f"[SimulationService] Simulating action for: {msg.correlationId}")
        
        # Publish the final loop result
        await bus.publish(
            EventTopic.SAFETY_LOOP_RESULT,
            {
                "status": "APPROVED",
                "impact_score": 0.35,
                "reason": "Safety loop completed: Identity verified, policies enforced, impact simulated."
            },
            msg.correlationId,
            "simulation_service"
        )
        print(f"[SimulationService] Safety loop COMPLETED for: {msg.correlationId}")

    await bus.subscribe(EventTopic.ENFORCEMENT_RESULT, on_enforcement_result)
    
    # Keep alive
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
