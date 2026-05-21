from datetime import datetime, timezone
from fastapi import HTTPException
from repositories.publish_repository import publish_repository
from repositories.content_repository import content_repository
from social.providers.instagram import instagram
from social.providers.linkedin import linkedin
from publishing.scheduler import schedule_post as _scheduler_schedule_post, cancel_scheduled_post


async def _execute_publish(publish_record: dict) -> None:
    content = content_repository.find_by_id(publish_record["content_id"])
    if not content:
        publish_repository.update_publish_record(publish_record["id"], {
            "status": "failed",
            "result": {"error": "Content not found"},
            "published_at": datetime.now(timezone.utc).isoformat(),
        })
        return

    result = {}
    for platform in publish_record["platforms"]:
        connection = publish_repository.find_connection_by_user_and_platform(
            publish_record["user_id"], platform
        )
        if not connection:
            result[platform] = {"success": False, "error": "Account not connected"}
            continue

        try:
            if platform == "instagram":
                caption_text = (
                    f"{publish_record['caption']}\n"
                    + " ".join(f"#{h}" for h in publish_record["hashtags"])
                )
                r = await instagram.publish_photo(
                    access_token=connection["access_token"],
                    user_id=connection["account_id"],
                    caption=caption_text,
                )
                result[platform] = {
                    "success": r["success"],
                    "postId": r["postId"],
                    "note": r.get("note"),
                }
            elif platform == "linkedin":
                r = await linkedin.publish_post(
                    caption=publish_record["caption"],
                    hashtags=publish_record["hashtags"],
                )
                result[platform] = {
                    "success": r["success"],
                    "postId": r["postId"],
                    "note": r.get("note"),
                }
            else:
                result[platform] = {"success": False, "error": f"Platform {platform} not supported"}
        except Exception as e:
            result[platform] = {"success": False, "error": str(e)}

    all_failed = all(not result[p].get("success") for p in publish_record["platforms"])
    publish_repository.update_publish_record(publish_record["id"], {
        "status": "failed" if all_failed else "published",
        "result": result,
        "published_at": datetime.now(timezone.utc).isoformat(),
    })


async def publish_now(
    user_id: str,
    content_id: str,
    platforms: list,
    caption: str,
    hashtags: list,
) -> dict:
    record = publish_repository.create_publish_record({
        "user_id": user_id,
        "content_id": content_id,
        "platforms": platforms,
        "caption": caption,
        "hashtags": hashtags,
        "scheduled_at": None,
        "status": "pending",
        "result": {},
    })
    await _execute_publish(record)
    return publish_repository.find_publish_record_by_id(record["id"])


def schedule_new_post(
    user_id: str,
    content_id: str,
    platforms: list,
    caption: str,
    hashtags: list,
    scheduled_at: str,
) -> dict:
    record = publish_repository.create_publish_record({
        "user_id": user_id,
        "content_id": content_id,
        "platforms": platforms,
        "caption": caption,
        "hashtags": hashtags,
        "scheduled_at": scheduled_at,
        "status": "pending",
        "result": {},
    })
    _scheduler_schedule_post(record, _execute_publish)
    return record


def get_scheduled(user_id: str) -> list:
    return publish_repository.find_scheduled_by_user_id(user_id)


def cancel_scheduled(user_id: str, record_id: str) -> dict:
    record = publish_repository.find_publish_record_by_id(record_id)
    if not record or record["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    cancel_scheduled_post(record_id)
    return publish_repository.update_publish_record(record_id, {"status": "cancelled"})


def get_history(user_id: str) -> list:
    return publish_repository.find_history_by_user_id(user_id)
