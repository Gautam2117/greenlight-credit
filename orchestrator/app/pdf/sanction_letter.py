from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ---------- Font setup (₹ support) ----------
def _find_font(fname: str) -> Optional[Path]:
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu") / fname,                   # Debian/Ubuntu
        Path(__file__).resolve().parent.parent / "assets" / "fonts" / fname # vendored fallback
    ]
    for p in candidates:
        if p.exists():
            return p
    return None

DV_REG = _find_font("DejaVuSans.ttf")
DV_BLD = _find_font("DejaVuSans-Bold.ttf")
USE_DV = bool(DV_REG and DV_BLD)

if USE_DV:
    pdfmetrics.registerFont(TTFont("DejaVuSans", str(DV_REG)))
    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", str(DV_BLD)))
    FONT_REG = "DejaVuSans"
    FONT_BLD = "DejaVuSans-Bold"
else:
    # Fallback (no ₹ glyph) - we’ll prefix with “Rs ” in formatting
    FONT_REG = "Helvetica"
    FONT_BLD = "Helvetica-Bold"

# ---------- Helpers ----------
def _p(text: Any, style: ParagraphStyle) -> Paragraph:
    return Paragraph("" if text is None else str(text), style)

def _format_inr(n: Any) -> str:
    """Format as Indian currency string. Uses ₹ when Unicode font is available, else 'Rs '."""
    try:
        v = int(round(float(n)))
    except Exception:
        return str(n or "")
    s = str(v)
    if len(s) <= 3:
        grp = s
    else:
        last3 = s[-3:]
        rest = s[:-3]
        parts = []
        while len(rest) > 2:
            parts.append(rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.append(rest)
        grp = ",".join(reversed(parts)) + "," + last3
    prefix = "₹" if USE_DV else "Rs "
    return f"{prefix}{grp}"

# ---------- Styles ----------
_BASE = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=_BASE["Heading1"], fontName=FONT_BLD,
                    fontSize=18, leading=22, textColor=colors.black, spaceAfter=8)
H2 = ParagraphStyle("H2", parent=_BASE["Heading2"], fontName=FONT_BLD,
                    fontSize=12, leading=15, textColor=colors.HexColor("#2A2A2A"),
                    spaceBefore=6, spaceAfter=4)
BODY = ParagraphStyle("BODY", parent=_BASE["BodyText"], fontName=FONT_REG,
                      fontSize=10, leading=13, textColor=colors.HexColor("#202020"))
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=8, textColor=colors.HexColor("#666"))
CELL_L = ParagraphStyle("CELL_L", parent=BODY, alignment=TA_LEFT)
CELL_R = ParagraphStyle("CELL_R", parent=BODY, alignment=TA_RIGHT)

# ---------- Main ----------
def generate_pdf(path: str, kfs: Dict[str, Any]) -> str:
    """
    Build a clean, audit-friendly sanction letter.
    kfs keys expected: Name, PAN last 4, Amount, Tenure, EMI, APR, MandateID
    """
    Path(path).parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        path, pagesize=A4,
        rightMargin=18*mm, leftMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm,
        title="Sanction Letter", author="GreenLight Credit"
    )

    now = datetime.now()
    ref = f"GLC-{now.strftime('%Y%m%d')}-{kfs.get('MandateID','XXXX')}"

    story = []
    # Header
    story.append(_p("GreenLight Credit - Sanction Letter", H1))
    story.append(_p(f"Reference: {ref}", SMALL))
    story.append(_p(now.strftime("Date: %d %b %Y, %I:%M %p"), SMALL))
    story.append(HRFlowable(color=colors.HexColor("#d8d8d8"),
                            width="100%", thickness=0.7, spaceBefore=6, spaceAfter=10))

    # Borrower
    story.append(_p("Borrower", H2))
    borrower_tbl = Table(
        [
            [_p("Name", CELL_L), _p(kfs.get("Name", "-"), CELL_R)],
            [_p("PAN last 4", CELL_L), _p(kfs.get("PAN last 4", "-"), CELL_R)],
        ],
        colWidths=[60*mm, None], hAlign="LEFT"
    )
    borrower_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(borrower_tbl)
    story.append(Spacer(1, 6))

    # Loan Summary
    story.append(_p("Loan Summary", H2))
    summary_tbl = Table(
        [
            [_p("Sanctioned amount", CELL_L), _p(_format_inr(kfs.get("Amount")), CELL_R)],
            [_p("Tenure (months)", CELL_L), _p(kfs.get("Tenure", "-"), CELL_R)],
            [_p("EMI (approx.)", CELL_L), _p(_format_inr(kfs.get("EMI")), CELL_R)],
            [_p("APR", CELL_L), _p(kfs.get("APR", "-"), CELL_R)],
            [_p("e-Mandate ID", CELL_L), _p(kfs.get("MandateID", "-"), CELL_R)],
        ],
        colWidths=[70*mm, None], hAlign="LEFT"
    )
    summary_tbl.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#C8CBD0")),
        ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 10))

    # Important Notes
    story.append(_p("Important Notes", H2))
    notes = [
        "This sanction is based on the information provided and the outcome of CKYC/AA/bureau checks.",
        "The final Key Fact Statement (KFS) and schedule are shared separately. EMI may vary slightly post-fee and schedule finalization.",
        "Please keep your e-mandate ID handy for future reference.",
    ]
    for n in notes:
        story.append(_p(f"• {n}", BODY))
    story.append(Spacer(1, 8))

    # Footer
    story.append(HRFlowable(color=colors.HexColor("#d8d8d8"),
                            width="100%", thickness=0.7, spaceBefore=6, spaceAfter=6))
    story.append(_p("Digitally issued by GreenLight Credit. This is a system-generated document, no signature required.", SMALL))
    story.append(_p("For any queries, contact support@greenlight.example", SMALL))

    doc.build(story)
    return path
