import asyncio
from typing import Callable, Awaitable
from datetime import datetime, timezone

# In-memory scheduler using asyncio tasks for precise one-shot post delivery.
# Limitation: all scheduled posts are lost on process restart.
# For production: replace with Celery + Redis or similar — only this file needs to change.
_scheduled_tasks: dict = {}


def init_scheduler() -> None:
    print("[scheduler] In-memory asyncio scheduler started. Note: scheduled posts reset on restart.")


async def _sleep_then_execute(
    record_id: str,
    delay: float,
    execute_fn: Callable,
    publish_record: dict,
) -> None:
    try:
        if delay > 0:
            await asyncio.sleep(delay)
        _scheduled_tasks.pop(record_id, None)
        await execute_fn(publish_record)
    except asyncio.CancelledError:
        _scheduled_tasks.pop(record_id, None)


def schedule_post(publish_record: dict, execute_fn: Callable[..., Awaitable]) -> None:
    scheduled_at = datetime.fromisoformat(publish_record["scheduled_at"])
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    delay = (scheduled_at - datetime.now(timezone.utc)).total_seconds()

    if delay <= 0:
        asyncio.create_task(execute_fn(publish_record))
        return

    task = asyncio.create_task(
        _sleep_then_execute(publish_record["id"], delay, execute_fn, publish_record)
    )
    _scheduled_tasks[publish_record["id"]] = task


def cancel_scheduled_post(record_id: str) -> bool:
    task = _scheduled_tasks.pop(record_id, None)
    if not task:
        return False
    task.cancel()
    return True
