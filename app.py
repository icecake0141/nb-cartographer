from __future__ import annotations

import csv
import io
import json
import re
from dataclasses import dataclass
from typing import Any
from collections import Counter

from flask import Flask, render_template, request

app = Flask(__name__)


@dataclass
class CableRow:
    a_endpoint: str
    b_endpoint: str
    cable_label: str
    cable_type: str
    cable_color: str
    edge_label: str
    raw: dict[str, Any]


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def detect_encoding(file_bytes: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp932", "shift_jis"):
        try:
            file_bytes.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    return "utf-8"


def find_column(headers: list[str], patterns: list[str]) -> str | None:
    normalized = {h: normalize(h) for h in headers}
    for pattern in patterns:
        regex = re.compile(pattern)
        for original, norm in normalized.items():
            if regex.search(norm):
                return original
    return None


def choose_columns(headers: list[str]) -> dict[str, str | None]:
    return {
        "a_device": find_column(headers, [r"terminationa.*device", r"sidea.*device", r"devicea", r"adevice"]),
        "a_port": find_column(headers, [r"terminationa.*(name|port)", r"^terminationa$", r"interfacea", r"porta", r"aname"]),
        "b_device": find_column(headers, [r"terminationb.*device", r"sideb.*device", r"deviceb", r"bdevice"]),
        "b_port": find_column(headers, [r"terminationb.*(name|port)", r"^terminationb$", r"interfaceb", r"portb", r"bname"]),
        "cable_id": find_column(headers, [r"^id$", r"cable.*id", r"^pk$", r"objectid"]),
        "cable_label": find_column(headers, [r"^label$", r"cable.*label", r"name"]),
        "cable_type": find_column(headers, [r"^type$", r"cable.*type", r"mediatype"]),
        "cable_color": find_column(headers, [r"^color$", r"cable.*color"]),
    }


def build_endpoint(device: str, port: str) -> str:
    device = (device or "").strip()
    port = (port or "").strip()
    if device and port:
        return f"{device}:{port}"
    if device:
        return device
    return port


TYPE_PALETTE = [
    "#0f766e",
    "#2563eb",
    "#7c3aed",
    "#be123c",
    "#ea580c",
    "#0891b2",
    "#4d7c0f",
    "#334155",
]


def stable_type_color(cable_type: str) -> str:
    n = sum(ord(ch) for ch in cable_type)
    return TYPE_PALETTE[n % len(TYPE_PALETTE)]


def normalize_color(color: str | None, cable_type: str) -> str:
    value = (color or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        return value.lower()
    return stable_type_color(cable_type)


def parse_cables_csv(file_bytes: bytes) -> tuple[list[CableRow], dict[str, str | None]]:
    enc = detect_encoding(file_bytes)
    text = file_bytes.decode(enc)
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    if not headers:
        raise ValueError("CSV header is missing.")

    columns = choose_columns(headers)
    rows: list[CableRow] = []

    for idx, row in enumerate(reader, start=1):
        a_device = row.get(columns["a_device"] or "", "") if columns["a_device"] else ""
        a_port = row.get(columns["a_port"] or "", "") if columns["a_port"] else ""
        b_device = row.get(columns["b_device"] or "", "") if columns["b_device"] else ""
        b_port = row.get(columns["b_port"] or "", "") if columns["b_port"] else ""

        a_endpoint = build_endpoint(a_device, a_port)
        b_endpoint = build_endpoint(b_device, b_port)
        if not a_endpoint and not b_endpoint:
            continue

        cable_label = ""
        if columns["cable_label"]:
            cable_label = (row.get(columns["cable_label"] or "", "") or "").strip()
        if not cable_label and columns["cable_id"]:
            cable_label = f"Cable-{(row.get(columns['cable_id'] or '', '') or '').strip() or idx}"
        if not cable_label:
            cable_label = f"Cable-{idx}"

        cable_type = "Unknown"
        if columns["cable_type"]:
            cable_type = (row.get(columns["cable_type"] or "", "") or "").strip() or "Unknown"

        raw_color = ""
        if columns["cable_color"]:
            raw_color = (row.get(columns["cable_color"] or "", "") or "").strip()

        cable_color = normalize_color(raw_color, cable_type)
        edge_label = f"{cable_label} [{cable_type}]"

        rows.append(
            CableRow(
                a_endpoint=a_endpoint or f"Unknown-A-{idx}",
                b_endpoint=b_endpoint or f"Unknown-B-{idx}",
                cable_label=cable_label,
                cable_type=cable_type,
                cable_color=cable_color,
                edge_label=edge_label,
                raw=row,
            )
        )

    return rows, columns


def build_graph(rows: list[CableRow]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    node_ids: set[str] = set()
    nodes: list[dict[str, str]] = []
    edges: list[dict[str, str]] = []

    for i, row in enumerate(rows, start=1):
        for endpoint in (row.a_endpoint, row.b_endpoint):
            if endpoint not in node_ids:
                node_ids.add(endpoint)
                nodes.append({"data": {"id": endpoint, "label": endpoint}})

        edges.append(
            {
                "data": {
                    "id": f"e{i}",
                    "source": row.a_endpoint,
                    "target": row.b_endpoint,
                    "label": row.edge_label,
                    "cable_label": row.cable_label,
                    "cable_type": row.cable_type,
                    "color": row.cable_color,
                }
            }
        )

    return nodes, edges


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.post("/upload")
def upload() -> str:
    file = request.files.get("csv_file")
    if not file or not file.filename:
        return render_template("index.html", error="CSVファイルを選択してください。")

    try:
        rows, columns = parse_cables_csv(file.read())
    except Exception as exc:
        return render_template("index.html", error=f"CSV解析に失敗しました: {exc}")

    if not rows:
        return render_template("index.html", error="接続データを抽出できませんでした。列名を確認してください。")

    nodes, edges = build_graph(rows)
    missing = [name for name, col in columns.items() if col is None and name in {"a_device", "a_port", "b_device", "b_port"}]
    type_counter = Counter(r.cable_type for r in rows)
    legend_map: dict[str, str] = {}
    for r in rows:
        legend_map.setdefault(r.cable_type, r.cable_color)
    type_legend = [
        {"type": cable_type, "count": count, "color": legend_map.get(cable_type, "#64748b")}
        for cable_type, count in type_counter.most_common()
    ]

    return render_template(
        "index.html",
        graph_json=json.dumps(nodes + edges, ensure_ascii=False),
        rows=rows,
        node_count=len(nodes),
        edge_count=len(edges),
        columns=columns,
        missing=missing,
        type_legend=type_legend,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
