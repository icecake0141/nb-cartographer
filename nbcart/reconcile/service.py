from __future__ import annotations

from nbcart.models import CableRow

from .collectors import COLLECTORS
from .match import reconcile
from .models import LinkRecord, ReconcileReport
from .normalize import link_key, normalize_link


def expected_links_from_rows(rows: list[CableRow]) -> list[LinkRecord]:
    links = {
        normalize_link(row.a_device, row.a_interface, row.b_device, row.b_interface)
        for row in rows
        if row.a_device and row.a_interface and row.b_device and row.b_interface
    }
    return sorted(
        links,
        key=lambda item: (
            item.left.device,
            item.left.interface,
            item.right.device,
        ),
    )


def _norm_identity(value: str) -> str:
    return (value or "").strip().lower()


def _build_identity_aliases(params: dict[str, object]) -> dict[str, str]:
    raw = params.get("identity_hints")
    if not isinstance(raw, dict):
        return {}
    aliases: dict[str, str] = {}
    for canonical_raw, hint in raw.items():
        canonical = _norm_identity(str(canonical_raw))
        if not canonical:
            continue
        aliases[canonical] = canonical
        if not isinstance(hint, dict):
            continue
        for key in ("aliases", "chassis_ids", "mgmt_ips"):
            values = hint.get(key)
            if not isinstance(values, list):
                continue
            for item in values:
                alias = _norm_identity(str(item))
                if alias:
                    aliases[alias] = canonical
    return aliases


def _canonicalize_links(links: list[LinkRecord], aliases: dict[str, str]) -> list[LinkRecord]:
    if not aliases:
        return links
    out: dict[str, LinkRecord] = {}
    for link in links:
        left_device = aliases.get(_norm_identity(link.left.device), link.left.device)
        right_device = aliases.get(_norm_identity(link.right.device), link.right.device)
        normalized = normalize_link(
            left_device,
            link.left.interface,
            right_device,
            link.right.interface,
        )
        out[link_key(normalized)] = normalized
    return sorted(out.values(), key=lambda item: link_key(item))


def collect_observed_links(
    *,
    method: str,
    seed_device: str,
    params: dict[str, object],
) -> tuple[list[LinkRecord], dict[str, object]]:
    collector = COLLECTORS.get(method)
    if collector is None:
        raise ValueError(f"Unsupported method: {method}")
    observed = collector.collect(seed_device=seed_device, params=params)
    metadata = getattr(collector, "last_metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
    details: dict[str, object] = {
        "method": method,
        "collector": collector.__class__.__name__,
        "observed_links": len(observed),
    }
    details.update(metadata)
    return observed, details


def reconcile_links(
    *,
    rows: list[CableRow],
    method: str,
    seed_device: str,
    params: dict[str, object],
) -> ReconcileReport:
    expected = expected_links_from_rows(rows)
    observed, collection_meta = collect_observed_links(
        method=method,
        seed_device=seed_device,
        params=params,
    )
    aliases = _build_identity_aliases(params)
    expected = _canonicalize_links(expected, aliases)
    observed = _canonicalize_links(observed, aliases)
    report = reconcile(expected, observed)
    report.collection = collection_meta
    report.collection["identity_alias_count"] = len(aliases)
    return report
