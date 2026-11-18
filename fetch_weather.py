#!/usr/bin/env python3
"""Fetch air-quality/weather data from ACAIR CMU, append new rows to data/weather.csv,
and embed the latest aqi/temp into index.html."""
import csv
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

URL = "https://dashboard.acair.cmu.ac.th/api/data?reslution="
OUT = Path(__file__).resolve().parent / "data" / "weather.csv"
HTML = Path(__file__).resolve().parent / "index.html"
EMBED_RE = re.compile(r"(/\*EMBED_START\*/)(.*?)(/\*EMBED_END\*/)", re.S)
TZ = timezone(timedelta(hours=7))  # timestamps from the API are Thai local time
FIELDS = ["timestamp", "pm25", "no2", "so2", "co", "o3", "wind_speed",
          "wind_dir", "temp", "hum", "press", "aqi"]


def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": "acair-hourly-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        payload = json.load(r)
    if payload.get("status") != "success":
        raise RuntimeError(f"API status: {payload.get('status')}")
    return payload["data"]


def to_row(rec):
    ts = datetime.strptime(rec["timestamp"], "%d/%m/%Y %H:%M:%S").replace(tzinfo=TZ)
    row = {"timestamp": ts.isoformat()}
    for f in FIELDS[1:]:
        v = rec.get(f)
        row[f] = "" if v in (None, "-", "") else v
    return row


def embed_in_html(data):
    """Write the latest aqi/temp into index.html so it can be opened as a single file."""
    try:
        latest = {"timestamp": data["timestamp"], "aqi": float(data["aqi"]), "temp": float(data["temp"])}
    except (KeyError, TypeError, ValueError):
        return  # aqi/temp missing ("-"): keep the previous embedded values
    html = HTML.read_text(encoding="utf-8")
    new, n = EMBED_RE.subn(lambda m: m.group(1) + json.dumps(latest) + m.group(3), html)
    if n != 1:
        raise RuntimeError("EMBED markers not found in index.html")
    tmp = HTML.with_suffix(".tmp")
    tmp.write_text(new, encoding="utf-8")
    tmp.replace(HTML)


def main():
    data = fetch()
    embed_in_html(data)
    incoming = [to_row(r) for r in data.get("history", []) + [data]]

    rows = {}
    if OUT.exists():
        with OUT.open(newline="") as f:
            rows = {r["timestamp"]: r for r in csv.DictReader(f)}
    before = len(rows)
    for r in incoming:
        old = rows.get(r["timestamp"])
        # keep existing row unless the new one fills in values the old one lacked
        if old is None or sum(v != "" for v in r.values()) > sum(v != "" for v in old.values()):
            rows[r["timestamp"]] = {k: str(v) for k, v in r.items()}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    with tmp.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows[k] for k in sorted(rows))
    tmp.replace(OUT)
    print(f"{datetime.now(TZ).isoformat(timespec='seconds')} ok: +{len(rows) - before} rows, total {len(rows)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"{datetime.now(TZ).isoformat(timespec='seconds')} error: {e}", file=sys.stderr)
        sys.exit(1)
