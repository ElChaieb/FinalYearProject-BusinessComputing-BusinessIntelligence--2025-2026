# Backend/app/scheduler.py
# ============================================================
# APScheduler setup — runs sync_opdb_to_dwh() every 30 min.
# The scheduler is started/stopped via FastAPI's lifespan hook.
# ============================================================

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler()


def _run_sync():
    """Wrapper called by APScheduler — imports lazily to avoid circular deps."""
    try:
        from etl.opdb_sync.sync_engine import sync_opdb_to_dwh
        result = sync_opdb_to_dwh()
        inserted = result.get("total_inserted", 0)
        error    = result.get("error")
        if error:
            logger.error(f"[auto-sync] error: {error}")
        else:
            logger.info(f"[auto-sync] completed — {inserted} rows inserted")
    except Exception as e:
        logger.error(f"[auto-sync] unexpected error: {e}")


def start_scheduler(interval_minutes: int = 30):
    """Add the sync job and start the scheduler."""
    scheduler.add_job(
        _run_sync,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="opdb_sync",
        name="OpDB → DWH sync",
        replace_existing=True,
        max_instances=1,          # never run two syncs at once
    )
    scheduler.start()
    logger.info(f"[scheduler] started — OpDB sync every {interval_minutes} min")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[scheduler] stopped")
