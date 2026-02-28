from __future__ import annotations

from ..models import LinkRecord


class SshLldpCollector:
    def collect(self, *, seed_device: str, params: dict[str, object]) -> list[LinkRecord]:
        _ = seed_device
        _ = params
        raise NotImplementedError("SSH collector is not implemented yet.")
