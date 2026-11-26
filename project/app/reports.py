"""Department carbon, credit, bill, and payment reports."""

from datetime import datetime, timezone
import re
import textwrap

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import accessible_department, get_current_session
from app.database import Bill, CreditAccount, CreditPurchase, CreditTransaction, Department, EmissionAnalysis, User, UserSession, get_db
from app.mail import send_email

router = APIRouter(prefix="/reports", tags=["reports"])


def report_department(db: Session, user: User, requested: int | None) -> Department:
    department_id = requested or user.department_id
    if department_id is None:
        raise HTTPException(status_code=400, detail="Create a department before generating a report")
    if user.role == "admin":
        return accessible_department(db, user, department_id)
    if department_id != user.department_id:
        raise HTTPException(status_code=403, detail="This report belongs to another department")
    department = db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found")
    return department


def pdf_escape(value: str) -> str:
    replacements = {"—": "-", "–": "-", "₂": "2", "•": "-", "₹": "INR "}
    for source, replacement in replacements.items():
        value = value.replace(source, replacement)
    return value.encode("latin-1", "replace").decode("latin-1").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def pdf_document(pages: list[str]) -> bytes:
    """Write PDF streams using built-in Type 1 fonts; no extra runtime package."""
    objects: list[bytes] = [b"<< /Type /Catalog /Pages 2 0 R >>", b""]
    page_ids: list[int] = []
    for page in pages:
        content = page.encode("latin-1", "replace")
        content_id = len(objects) + 1
        page_id = content_id + 1
        objects.append(f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"\nendstream")
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents {content_id} 0 R >>".encode())
        page_ids.append(page_id)
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(f'{item} 0 R' for item in page_ids)}] /Count {len(page_ids)} >>".encode()
    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, value in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode() + value + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    output.extend(b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:]))
    output.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(output)


def report_pdf(department: str, now: datetime, summary: dict, analyses: list[EmissionAnalysis], purchases: list[CreditPurchase]) -> bytes:
    """Create a visual, print-friendly Atmos PDF report with structured sections."""
    def rect(x: float, y: float, width: float, height: float, color: tuple[float, float, float]) -> str:
        return f"q {color[0]} {color[1]} {color[2]} rg {x} {y} {width} {height} re f Q"

    def text(x: float, y: float, value: str, size: float = 10, bold: bool = False, color: tuple[float, float, float] = (.08, .22, .16)) -> str:
        return f"BT /F{'2' if bold else '1'} {size} Tf {color[0]} {color[1]} {color[2]} rg 1 0 0 1 {x} {y} Tm ({pdf_escape(value)}) Tj ET"

    def wrapped(x: float, y: float, value: str, width: int, size: float = 9, leading: float = 12, color: tuple[float, float, float] = (.23, .34, .28)) -> tuple[list[str], float]:
        commands: list[str] = []
        for line in textwrap.wrap(pdf_escape(value), width=width) or [""]:
            commands.append(text(x, y, line, size, color=color))
            y -= leading
        return commands, y

    dark, green, mint, paper, ink, muted, border = (.025, .16, .11), (.10, .42, .28), (.78, .94, .79), (.96, .98, .96), (.06, .20, .14), (.31, .43, .35), (.84, .90, .85)
    page: list[str] = [rect(0, 0, 612, 792, paper), rect(0, 642, 612, 150, dark), rect(0, 636, 612, 6, green)]
    page += [text(48, 744, "atmos.", 25, True, mint), text(48, 720, "DEPARTMENT CLIMATE REPORT", 9, True, mint), text(48, 680, department, 25, True, (1, 1, 1)), text(48, 660, "Evidence-led carbon accounting, credit usage, and verified payments.", 10, color=(.78, .89, .80)), text(425, 720, "GENERATED", 8, True, mint), text(425, 702, now.strftime("%d %b %Y"), 11, True, (1, 1, 1)), text(425, 685, now.strftime("%H:%M UTC"), 9, color=(.78, .89, .80))]
    page += [text(48, 603, "AT A GLANCE", 9, True, green), text(48, 579, "Your current carbon-accounting position", 16, True, ink)]
    cards = [
        (48, "CREDITS AVAILABLE", f"{summary['credit_balance']:,}", "Current department balance"),
        (230, "ESTIMATED EMISSIONS", f"{summary['total_co2e_kg']:,.1f} kg", "Across analyzed source evidence"),
        (412, "VERIFIED PAYMENTS", f"INR {summary['amount_paid_cents'] / 100:,.2f}", f"{summary['verified_payments']:,} completed payment(s)"),
    ]
    for x, label, value, note in cards:
        page += [rect(x, 480, 152, 76, (1, 1, 1)), text(x + 13, 535, label, 7.5, True, green), text(x + 13, 510, value, 16, True, ink), text(x + 13, 494, note, 7.5, color=muted)]
    page += [text(48, 444, "REPORTING SUMMARY", 9, True, green)]
    sections = [
        ("CREDIT USAGE", [("Credits retired for emissions", f"{summary['credits_used']:,}"), ("Ledger transactions", f"{summary['ledger_transactions']:,}")]),
        ("BILL ANALYSIS", [("Bills uploaded", f"{summary['bills_uploaded']:,}"), ("Bills analyzed", f"{summary['bills_analyzed']:,}"), ("Awaiting analysis", f"{summary['bills_awaiting_analysis']:,}")]),
        ("PAYMENT STATUS", [("Verified payments", f"{summary['verified_payments']:,}"), ("Total paid", f"INR {summary['amount_paid_cents'] / 100:,.2f}")]),
    ]
    y = 415
    for title, entries in sections:
        height = 31 + 20 * len(entries)
        page += [rect(48, y - height, 516, height, (1, 1, 1)), text(63, y - 20, title, 9, True, ink)]
        row_y = y - 40
        for label, value in entries:
            page += [text(63, row_y, label, 9, color=muted), text(535, row_y, value, 10, True, ink)]
            row_y -= 19
        y -= height + 12
    page += [text(48, 45, "Atmos - Measure. Reduce. Report.", 8, color=muted), text(468, 45, "Confidential workspace report", 8, color=muted)]
    pages = ["\n".join(page)]

    details: list[tuple[str, str]] = []
    details.extend(("ANALYZED EVIDENCE", f"{item.billing_period} | {item.category} | {item.co2e_kg:,.2f} kg CO2e\n{item.summary}") for item in analyses)
    details.extend(("VERIFIED PAYMENT", f"{item.paid_at:%d %b %Y} | {item.plan.title()} | {item.credits:,} credits | INR {item.amount / 100:,.2f}") for item in purchases if item.paid_at)
    if details:
        detail_page = [rect(0, 0, 612, 792, paper), rect(0, 720, 612, 72, dark), text(48, 756, "Report detail", 21, True, (1, 1, 1)), text(48, 736, department, 9, color=mint)]
        y = 686
        for kind, value in details:
            lines = textwrap.wrap(pdf_escape(value), width=80) or [""]
            height = 35 + len(lines) * 12
            if y - height < 60:
                detail_page += [text(48, 45, "Atmos - Measure. Reduce. Report.", 8, color=muted)]
                pages.append("\n".join(detail_page))
                detail_page = [rect(0, 0, 612, 792, paper), rect(0, 720, 612, 72, dark), text(48, 756, "Report detail (continued)", 21, True, (1, 1, 1))]
                y = 686
            detail_page += [rect(48, y - height, 516, height, (1, 1, 1)), text(63, y - 20, kind, 8, True, green)]
            cursor = y - 39
            for line in lines:
                detail_page.append(text(63, cursor, line, 9, color=ink))
                cursor -= 12
            y -= height + 10
        detail_page += [text(48, 45, "Atmos - Measure. Reduce. Report.", 8, color=muted)]
        pages.append("\n".join(detail_page))
    return pdf_document(pages)


def report_data(db: Session, department: Department) -> tuple[dict, bytes, str]:
    account = db.scalar(select(CreditAccount).where(CreditAccount.department_id == department.id))
    bills = list(db.scalars(select(Bill).where(Bill.department_id == department.id).order_by(Bill.created_at.desc())))
    analyses = list(db.scalars(select(EmissionAnalysis).where(EmissionAnalysis.department_id == department.id).order_by(EmissionAnalysis.created_at.desc())))
    purchases = list(db.scalars(select(CreditPurchase).where(CreditPurchase.department_id == department.id, CreditPurchase.status == "paid").order_by(CreditPurchase.paid_at.desc())))
    transactions = list(db.scalars(select(CreditTransaction).where(CreditTransaction.department_id == department.id).order_by(CreditTransaction.created_at.desc())))
    total_co2e = sum(item.co2e_kg for item in analyses)
    credits_used = sum(item.credits_used or 0 for item in analyses)
    paid_amount = sum(item.amount for item in purchases)
    now = datetime.now(timezone.utc)
    filename = f"atmos-{re.sub(r'[^a-z0-9]+', '-', department.name.lower()).strip('-') or 'department'}-report.pdf"
    summary = {
        "department": department.name,
        "credit_balance": account.balance if account else 0,
        "credits_used": credits_used,
        "ledger_transactions": len(transactions),
        "bills_uploaded": len(bills),
        "bills_analyzed": len(analyses),
        "bills_awaiting_analysis": max(0, len(bills) - len(analyses)),
        "total_co2e_kg": round(total_co2e, 2),
        "verified_payments": len(purchases),
        "amount_paid_cents": paid_amount,
        "generated_at": now.isoformat(),
    }
    return summary, report_pdf(department.name, now, summary, analyses, purchases), filename


@router.get("/download")
def download_report(department_id: int | None = Query(default=None, gt=0), db: Session = Depends(get_db), current: tuple[User, UserSession] = Depends(get_current_session)) -> Response:
    department = report_department(db, current[0], department_id)
    _, document, filename = report_data(db, department)
    return Response(document, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.post("/email")
def email_report(department_id: int | None = Query(default=None, gt=0), db: Session = Depends(get_db), current: tuple[User, UserSession] = Depends(get_current_session)) -> dict:
    user = current[0]
    department = report_department(db, user, department_id)
    summary, document, filename = report_data(db, department)
    delivered = send_email(user.email, f"Atmos report for {department.name}", f"Hi {user.name},\n\nYour Atmos department report is attached. It includes credit usage, bill analysis, and verified payment activity.\n\nCurrent balance: {summary['credit_balance']:,} credits\nEstimated emissions: {summary['total_co2e_kg']:,.2f} kg CO2e\n\n— The Atmos team", (filename, document, "application/pdf"))
    if not delivered:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Report created, but email could not be sent. Configure SMTP and try again.")
    return {"delivered": True, "recipient": user.email, "filename": filename, "summary": summary}
