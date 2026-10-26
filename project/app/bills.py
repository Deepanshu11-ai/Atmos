"""Department bill storage for data officers."""

from pathlib import Path
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from app.auth import accessible_department, get_current_session
from app.database import Bill, User, UserSession, get_db
from app.schemas import BillResponse

router = APIRouter(prefix="/bills", tags=["bills"])
MAX_PDF_SIZE = 10 * 1024 * 1024


def require_bill_uploader(
    current: tuple[User, UserSession] = Depends(get_current_session),
) -> User:
    user, _ = current
    if user.role not in ("admin", "data_officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bill upload is not available for this role")
    if user.department_id is None:
        raise HTTPException(status_code=400, detail="A department is required to manage bills")
    return user


def require_bill_viewer(
    current: tuple[User, UserSession] = Depends(get_current_session),
) -> User:
    user, _ = current
    if user.role not in ("admin", "data_officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bill access is not available for this role")
    return user


@router.get("", response_model=list[BillResponse])
def list_bills(
    department_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    viewer: User = Depends(require_bill_viewer),
) -> list[Bill]:
    target = department_id or viewer.department_id
    if target is None:
        raise HTTPException(status_code=400, detail="A department is required to view bills")
    if viewer.role == "admin":
        accessible_department(db, viewer, target)
    elif target != viewer.department_id:
        raise HTTPException(status_code=403, detail="Bills belong to another department")
    return list(db.scalars(
        select(Bill)
        .options(load_only(
            Bill.id, Bill.department_id, Bill.uploaded_by, Bill.filename,
            Bill.content_type, Bill.size_bytes, Bill.created_at,
        ))
        .where(Bill.department_id == target)
        .order_by(Bill.created_at.desc())
    ))


@router.post("", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def upload_bill(
    file: UploadFile = File(...),
    department_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
    uploader: User = Depends(require_bill_uploader),
) -> Bill:
    target = department_id or uploader.department_id
    if target is None:
        raise HTTPException(status_code=400, detail="A department is required to upload bills")
    if uploader.role == "admin":
        accessible_department(db, uploader, target)
    elif target != uploader.department_id:
        raise HTTPException(status_code=403, detail="Bills can only be uploaded to your department")
    filename = Path(file.filename or "bill.pdf").name[:255]
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF bills can be uploaded")
    content = await file.read(MAX_PDF_SIZE + 1)
    await file.close()
    if not content:
        raise HTTPException(status_code=400, detail="The selected PDF is empty")
    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="PDF bills must be 10 MB or smaller")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="The selected file is not a valid PDF")

    bill = Bill(
        department_id=target,
        uploaded_by=uploader.user_id,
        filename=filename,
        content_type="application/pdf",
        size_bytes=len(content),
        content=content,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


@router.get("/{bill_id}/file")
def download_bill(
    bill_id: UUID,
    db: Session = Depends(get_db),
    viewer: User = Depends(require_bill_viewer),
) -> Response:
    bill = db.get(Bill, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    if viewer.role == "admin":
        accessible_department(db, viewer, bill.department_id)
    elif bill.department_id != viewer.department_id:
        raise HTTPException(status_code=404, detail="Bill not found")
    return Response(
        content=bill.content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(bill.filename)}"},
    )
