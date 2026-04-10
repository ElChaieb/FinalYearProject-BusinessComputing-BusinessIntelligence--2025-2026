# opdb_etl/utils/logger.py

import logging
import os
from datetime import datetime

os.makedirs("opdb_etl/logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(
            f"opdb_etl/logs/opdb_etl_{datetime.now().strftime('%Y%m%d')}.log"
        ),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger("opdb_etl")
