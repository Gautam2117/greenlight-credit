def pull_score(pan_last4: str | None) -> dict:
    s = str(pan_last4 or "")
    # demo scoring: if we have a digit, vary score by last digit; else default
    last_digit = int(s[-1]) if s.isdigit() and len(s) >= 1 else 7
    score = 660 + last_digit * 20
    return {"score": score}
