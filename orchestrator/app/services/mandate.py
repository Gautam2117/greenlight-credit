def create_mandate(session_id: str, bank: str, upi: str) -> dict:
    return {"status":"ok","mandate_id": f"MDT-{session_id[-6:]}"}
