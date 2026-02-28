from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ReconcileError(Exception):
    message: str
    code: str
    stage: str
    hint: str = ""
    http_status: int = 422

    def __str__(self) -> str:
        return self.message

    def to_dict(self) -> dict[str, object]:
        return {
            "error": self.message,
            "error_code": self.code,
            "stage": self.stage,
            "hint": self.hint,
        }
