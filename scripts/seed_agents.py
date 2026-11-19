import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.base import Base
from app.db import models as _models
from app.db.models.agent import Agent
from app.db.session import AsyncSessionLocal, engine
from app.repositories.agent_repo import AgentRepository

SEED_AGENTS = [
    {
        "slug": "customer-support",
        "name": "Customer Support Agent",
        "model": "gpt-4o",
        "system_prompt": (
            "You are a polite customer support agent. Answer from the retrieved knowledge. "
            "If the knowledge does not contain the answer, say that you do not know. "
            "Call escalate_to_human when the person asks for a human or you cannot resolve the request."
        ),
    },
    {
        "slug": "lead-generation",
        "name": "Lead Generation Agent",
        "model": "gpt-4o",
        "system_prompt": (
            "You are a lead generation agent. Ask one qualifying question at a time. "
            "Collect the person's name and email before you close the conversation. "
            "Use retrieved knowledge for product facts. Do not invent prices or features."
        ),
    },
    {
        "slug": "appointment-booking",
        "name": "Appointment Booking Agent",
        "model": "gpt-4o",
        "system_prompt": (
            "You are an appointment booking agent. Ask for the reason and a preferred time, "
            "then call book_appointment. You do not have a live calendar; the tool only records the request. "
            "Repeat the recorded time back to the person. Call escalate_to_human if they need a person."
        ),
    },
]


async def seed() -> None:
    _ = _models
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        repo = AgentRepository(session)
        created = 0
        for item in SEED_AGENTS:
            if await repo.get_by_slug(item["slug"]):
                continue
            await repo.add(Agent(**item))
            created += 1
        await session.commit()
        print(f"seeded {created} agents")


if __name__ == "__main__":
    asyncio.run(seed())
