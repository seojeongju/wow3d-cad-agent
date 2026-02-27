"""Simple in-memory rate limiter for API endpoints."""
import time
from collections import defaultdict


class RateLimiter:
    def __init__(self, requests_per_minute: int = 30):
        self.rpm = requests_per_minute
        self._counts: dict[str, list[float]] = defaultdict(list)

    def _trim(self, key: str) -> None:
        cutoff = time.monotonic() - 60
        self._counts[key] = [t for t in self._counts[key] if t > cutoff]

    def allow(self, key: str) -> bool:
        self._trim(key)
        if len(self._counts[key]) >= self.rpm:
            return False
        self._counts[key].append(time.monotonic())
        return True


# Global limiter for upload/convert endpoints (e.g. 20 per minute per IP)
upload_limiter = RateLimiter(requests_per_minute=20)
