from pathlib import Path
import json

from app.pdf.sanction_letter import generate_pdf
from app.services import mandate, crm
from app.audit import check

DATA_DIR = Path("/app/data")

def run(session_id: str, decision: dict, customer: dict) -> dict:
    # Guardrails (non-blocking in demo)
    try:
        check("agent:sanction", "write", "pdf", {"session": session_id})
    except Exception:
        pass

    md = mandate.create_mandate(session_id, bank="HDFC", upi="test@upi")

    # Derive PAN last 4 robustly
    pan_src = (customer.get("pan_last4")
               or customer.get("pan_tail")
               or customer.get("pan")
               or "")
    pan_last4 = str(pan_src)[-4:] if pan_src else "-"

    # Build KFS payload used by PDF and UI
    kfs = {
        "Name": customer.get("name", "-"),
        "PAN last 4": pan_last4,
        "Amount": decision.get("amount"),
        "Tenure": decision.get("tenure"),
        "EMI": decision.get("emi"),
        "APR": f'{decision.get("apr", 0)}%',
        "MandateID": md.get("mandate_id"),
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Generate PDF
    pdf_fs = DATA_DIR / f"sanction_{session_id}.pdf"
    generate_pdf(str(pdf_fs), kfs)

    # Persist the exact KFS shown to user
    kfs_fs = DATA_DIR / f"kfs_{session_id}.json"
    with kfs_fs.open("w", encoding="utf-8") as f:
        json.dump(kfs, f, ensure_ascii=False, indent=2)

    try:
        check("agent:sanction", "write", "crm", {"file": str(pdf_fs)})
    except Exception:
        pass
    crm.update_customer(session_id, {"kfs": kfs, "pdf": str(pdf_fs)})

    # Return browser-accessible URLS plus parsed kfs for on-screen summary
    return {
        "ok": True,
        "pdf": f"/files/{pdf_fs.name}",
        "kfs": kfs,
        "kfs_url": f"/files/{kfs_fs.name}",
    }
