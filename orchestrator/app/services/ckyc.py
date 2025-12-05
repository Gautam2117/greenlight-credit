def verify_basic(name: str, pan_last4: str) -> dict:
    # mock pass
    return {"match": True, "name_normalized": name.upper(), "pan_tail": pan_last4}
