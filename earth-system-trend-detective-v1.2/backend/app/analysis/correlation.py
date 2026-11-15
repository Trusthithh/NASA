"""Correlation between two variables at one place."""
from typing import Any, Dict, List, Optional

import numpy as np
from scipy import stats

from app.analysis.trends import InsufficientDataError

MIN_CORR_POINTS = 10


def strength_label(r: float) -> str:
    a = abs(r)
    if a < 0.2:
        return "very weak"
    if a < 0.4:
        return "weak"
    if a < 0.6:
        return "moderate"
    if a < 0.8:
        return "strong"
    return "very strong"


def _lag1(v: np.ndarray) -> Optional[float]:
    if len(v) < 3 or float(np.std(v)) < 1e-12:
        return None
    r = float(np.corrcoef(v[:-1], v[1:])[0, 1])
    return r if np.isfinite(r) else None


def effective_n(n: int, r1x: Optional[float], r1y: Optional[float]) -> float:
    """AR(1)-style effective-n approximation; capped at the observed sample size.

    This is a heuristic based only on the two lag-1 autocorrelations. It is not
    a general correction for higher-order dependence, irregular sampling, or
    non-stationarity.
    """
    if n <= 2 or r1x is None or r1y is None:
        return float(n)
    prod = float(np.clip(r1x, -0.99, 0.99) * np.clip(r1y, -0.99, 0.99))
    if prod <= 0:
        return float(n)
    estimate = n * (1.0 - prod) / (1.0 + prod)
    return float(min(n, max(3.0, estimate)))


def adjusted_p(r: float, n_eff: float) -> float:
    """Approximate two-sided Pearson p-value using the heuristic effective n."""
    if not np.isfinite(r) or not np.isfinite(n_eff) or n_eff <= 2:
        return 1.0
    if abs(r) >= 1.0:
        return 0.0
    df = n_eff - 2.0
    t_stat = r * np.sqrt(df / max(1e-15, 1.0 - r * r))
    return float(2.0 * stats.t.sf(abs(t_stat), df))


def correlate(x: np.ndarray, y: np.ndarray, t: np.ndarray) -> Dict[str, Any]:
    n = int(len(x))
    if n < MIN_CORR_POINTS:
        raise InsufficientDataError(
            f"Only {n} paired observations; at least {MIN_CORR_POINTS} are needed for a correlation."
        )
    if float(np.std(x)) < 1e-12 or float(np.std(y)) < 1e-12:
        raise InsufficientDataError(
            "One of the variables has no variability here (for example snow cover in a warm "
            "place), so a correlation is undefined."
        )

    pearson_r, pearson_p = stats.pearsonr(x, y)
    spearman_rho, spearman_p = stats.spearmanr(x, y)

    dx = x - np.polyval(np.polyfit(t, x, 1), t)
    dy = y - np.polyval(np.polyfit(t, y, 1), t)
    detrended_r: Optional[float] = None
    detrended_p: Optional[float] = None
    if float(np.std(dx)) > 1e-12 and float(np.std(dy)) > 1e-12:
        detrended_r, detrended_p = (float(v) for v in stats.pearsonr(dx, dy))

    lag1_x, lag1_y = _lag1(x), _lag1(y)
    n_eff = effective_n(n, lag1_x, lag1_y)
    return {
        "n": n,
        "n_effective": float(n_eff),
        "pearson_r": float(pearson_r),
        "pearson_p": float(pearson_p),
        # Kept under the v1.4 response key for backwards compatibility.
        # v1.5 UI and interpretation explicitly call this an approximation.
        "pearson_p_adjusted": adjusted_p(float(pearson_r), n_eff),
        "pearson_p_adjustment_method": "Approximate Pearson t-test using lag-1 AR(1)-style effective sample size; heuristic only",
        "spearman_rho": float(spearman_rho),
        "spearman_p": float(spearman_p),
        "detrended_r": detrended_r,
        "detrended_p": detrended_p,
        "lag1_x": lag1_x,
        "lag1_y": lag1_y,
        "strength": strength_label(float(pearson_r)),
    }


def interpret(res: Dict[str, Any], x_name: str, y_name: str, resolution: str) -> List[str]:
    basis = "annual means" if resolution == "annual" else "deseasonalised monthly anomalies"
    lines = [
        f"Across {res['n']} paired {basis}, the Pearson correlation between {x_name} and "
        f"{y_name} is r = {res['pearson_r']:+.2f} ({res['strength']})."
    ]
    if res["pearson_p_adjusted"] < 0.05:
        lines.append(
            f"The lag-1 heuristic gives an approximate Pearson p-value of "
            f"{res['pearson_p_adjusted']:.4f} (effective n ≈ {res['n_effective']:.0f}); "
            "this is suggestive only, not a definitive serial-correlation correction."
        )
    else:
        lines.append(
            f"The heuristic autocorrelation adjustment gives an approximate Pearson p-value "
            f"of {res['pearson_p_adjusted']:.4f} (effective n ≈ {res['n_effective']:.0f}); "
            f"this approximation does not establish statistical significance on its own. "
            f"The conventional independent-observation Pearson p-value is {res['pearson_p']:.4f}."
        )
    if res["detrended_r"] is not None:
        lines.append(
            f"After removing each variable's linear trend, r = {res['detrended_r']:+.2f}. This "
            "shows whether the two vary together from period to period, beyond both simply trending."
        )
        if abs(res["pearson_r"]) >= 0.4 and abs(res["detrended_r"]) < 0.2:
            lines.append(
                "The raw correlation is mostly driven by shared long-term trends, not by "
                "period-to-period co-variation."
            )
    lines.append(
        "The effective-sample-size adjustment is a lag-1 heuristic; it does not fully model "
        "serial dependence, so its p-value is approximate rather than a definitive correction."
    )
    lines.append(
        "Correlation does not show cause and effect: a shared driver, or two unrelated trends, "
        "can produce the same pattern."
    )
    return lines
