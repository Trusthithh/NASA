"""Pure helpers for comparing two places."""
from typing import Any, Dict, List

import numpy as np

MIN_OVERLAP = 10


def intervals_overlap(a: List[float], b: List[float]) -> bool:
    return max(a[0], b[0]) <= min(a[1], b[1])


def compare_series(a: Dict[str, Any], b: Dict[str, Any], unit: str) -> Dict[str, Any]:
    """a and b: name, sen_slope, sen_slope_ci, is_significant, dates, anomalies."""
    diff = (a["sen_slope"] - b["sen_slope"]) * 10.0
    overlap = intervals_overlap(a["sen_slope_ci"], b["sen_slope_ci"])

    da = {d: v for d, v in zip(a["dates"], a["anomalies"]) if v is not None}
    db = {d: v for d, v in zip(b["dates"], b["anomalies"]) if v is not None}
    common = sorted(set(da) & set(db))
    correlation = None
    if len(common) >= MIN_OVERLAP:
        xa = np.array([da[d] for d in common], dtype=float)
        xb = np.array([db[d] for d in common], dtype=float)
        if xa.std() > 1e-12 and xb.std() > 1e-12:
            correlation = float(np.corrcoef(xa, xb)[0, 1])

    def describe(p: Dict[str, Any]) -> str:
        verdict = "significant" if p["is_significant"] else "not significant"
        return f"{p['name']}: {p['sen_slope'] * 10.0:+.3f} {unit} per decade ({verdict})"

    notes = [f"{describe(a)}; {describe(b)}."]
    if overlap:
        notes.append(
            "The 95% intervals of the two slopes overlap, so these data cannot show that the "
            "places are changing at different rates (an informal check, not a formal test)."
        )
    else:
        notes.append(
            "The 95% intervals of the two slopes do not overlap, which suggests the places are "
            "changing at different rates (an informal check, not a formal test)."
        )
    if correlation is not None:
        notes.append(
            f"Anomalies at the two places correlate at r = {correlation:+.2f} over "
            f"{len(common)} shared points, showing how closely they vary together."
        )
    return {
        "slope_difference_per_decade": float(diff),
        "ci_overlap": bool(overlap),
        "anomaly_correlation": correlation,
        "n_overlap": int(len(common)),
        "notes": notes,
    }
