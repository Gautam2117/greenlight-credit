import yaml
from pathlib import Path

from app.services import bureau
from app.audit import check

RULES = yaml.safe_load(
    Path(__file__).resolve().parents[1].joinpath("rules/policy.yaml").read_text()
)

def _get_pan(payload: dict) -> str:
    """Normalize PAN last-4 from pan_last4 / pan_tail / pan."""
    v = payload.get("pan_last4") or payload.get("pan_tail") or payload.get("pan") or ""
    s = str(v)
    return s[-4:] if s else ""

def _to_int(value, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default

def run(payload: dict) -> dict:
    # Normalize inputs
    pan = _get_pan(payload)
    preapproved = _to_int(payload.get("preapproved", 200000), 200000)
    desired = _to_int(payload.get("desired_amount", preapproved), preapproved)
    tenure = _to_int(payload.get("tenure", 24), 24)

    # Audit context uses normalized key
    if not check("agent:underwriting", "read", "bureau", {"pan_last4": pan}):
        pass

    # Bureau score (service itself should be defensive too)
    sc = bureau.pull_score(pan)["score"]

    # Policy checks
    min_cs = RULES["eligibility"]["min_credit_score"]
    multiplier = RULES["eligibility"]["preapproved_multiplier"]
    max_allowed = preapproved * multiplier

    if sc < min_cs or desired > max_allowed:
        return {"approve": False, "reason": "Policy breach", "score": sc}

    # Offer math (simple EMI)
    apr = RULES["offers"]["default_apr"]
    r = apr / 12 / 100
    emi = int(desired * r * (1 + r) ** tenure / ((1 + r) ** tenure - 1))

    return {
        "approve": True,
        "score": sc,
        "apr": apr,
        "emi": emi,
        "amount": desired,
        "tenure": tenure,
    }
