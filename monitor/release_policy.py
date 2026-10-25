"""Degraded release policy: trusted fallback, first/all-failure handling (UDR-027).

Fresh, verified data is published for successful projects. A failed project
reuses old data only when that data is recoverable from the trusted ``verified``
archive and its schema/profile is readable — otherwise it is ``unavailable``.
An authoritative pointer whose archive is missing or corrupted is a baseline
fault that blocks the whole round, never a "first run" or "project has no old
data" excuse. Old identity/profile/window/collection time are preserved and the
task still reports failure.
"""

from __future__ import annotations

import json

from .assemble import assemble_release
from .baseline import ReleaseStore
from .metrics import validate_profile
from .public_verify import sha256_bytes


def parse_snapshot_profile(data: bytes) -> str | None:
    """Extract the declared metric_profile from a readable JSON snapshot.

    Returns ``None`` when the bytes are not UTF-8 JSON or not an object, so a
    non-JSON blob is never re-interpreted with current semantics.
    """
    try:
        doc = json.loads(data.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(doc, dict):
        return None
    return doc.get("metric_profile")


def is_readable_fallback(entry: dict, archive_files: dict[str, bytes],
                         *, compatible_profiles: dict[str, str] | None = None) -> bool:
    """A fallback is usable only when the trusted archive holds a genuinely
    readable, compatible snapshot (ADR-006).

    The archived bytes must exist and match their fingerprint, parse as a JSON
    object, and declare a ``metric_profile`` that resolves to a known profile
    and equals this entry's profile (or is explicitly mapped to it). Non-JSON
    bytes or an obsolete/unknown profile is rejected as unreadable, and the
    original profile is never silently re-labelled.
    """
    rel = entry.get("snapshot_path")
    if not rel or rel not in archive_files:
        return False
    data = archive_files[rel]
    if entry.get("snapshot_sha256") and sha256_bytes(data) != entry["snapshot_sha256"]:
        return False
    declared = parse_snapshot_profile(data)
    if declared is None:
        return False
    current = entry.get("metric_profile")
    # The declared profile must resolve to this entry's profile, either directly
    # or through an explicit compatibility mapping, and that resolved profile
    # must itself be a known profile (never re-interpreted with current semantics).
    resolved = declared
    if resolved != current:
        resolved = (compatible_profiles or {}).get(resolved)
    if resolved != current:
        return False
    return not validate_profile(resolved)


def _to_unavailable(entry: dict, error: str) -> dict:
    out = {"task_status": entry.get("task_status", "failed"), "data_mode": "unavailable",
           "metric_profile": entry.get("metric_profile"), "error": error}
    return out


def degraded_release(
    store: ReleaseStore | None,
    catalog,
    context,
    reports,
    *,
    release_id: str,
    published_at: str,
    readable=None,
):
    """Compose a release with store-backed fallback; return ``(release, block)``.

    ``block`` is ``None`` on success, or a dict describing a blocking baseline
    fault. A baseline fault must stop the whole round even when another project
    produced fresh data.
    """
    readable = readable or is_readable_fallback
    baseline = None
    baseline_release_id = None
    archive_files: dict[str, bytes] = {}
    if store is not None:
        pointer = store.pointer()
        if pointer and pointer.get("current"):
            current = pointer["current"]
            try:
                baseline_manifest, archive_files = store.read_archive(current)
            except Exception as exc:
                return None, {"baseline_fault": f"authoritative pointer {current!r} references a missing archive: {exc}"}
            if store.verify_archive(current):
                return None, {"baseline_fault": f"authoritative pointer {current!r} references a corrupted archive"}
            if baseline_manifest.get("release_status") != "verified":
                return None, {"baseline_fault": f"authoritative pointer {current!r} references a non-verified release"}
            baseline = baseline_manifest
            baseline_release_id = current
    release = assemble_release(
        catalog, context, reports,
        release_id=release_id, published_at=published_at,
        baseline=baseline, baseline_release_id=baseline_release_id,
    )
    # Fallback is only trustworthy when the archived bytes are present and
    # match; an unreadable fallback is downgraded to unavailable, never a
    # re-labelled success.
    for pid, entry in list(release["projects"].items()):
        if entry.get("data_mode") == "fallback":
            if not readable(entry, archive_files):
                release["projects"][pid] = _to_unavailable(
                    entry, entry.get("error") or "trusted fallback snapshot unavailable or unreadable"
                )
    return release, None