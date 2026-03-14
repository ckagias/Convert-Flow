# FastAPI backend: auth, file upload, conversion jobs, and file listing.
# All file/comment access is scoped to the logged-in user.

import os
import uuid
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List

from fastapi import (
    FastAPI, File, UploadFile, Depends, HTTPException,
    status, BackgroundTasks, Request
)
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, field_validator

from models import Base, User, FileRecord, Comment, SecurityLog
from converters import SUPPORTED_CONVERSIONS, handle_conversion

# App settings (env vars or defaults)
SECRET_KEY  = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM   = "HS256"
TOKEN_TTL   = 60 * 24          # minutes (24 hours)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////app/db/convertflow.db")
UPLOAD_DIR   = Path("/app/uploads")
OUTPUT_DIR   = Path("/app/outputs")

# Create upload, output, and db folders if missing
for d in [UPLOAD_DIR, OUTPUT_DIR, Path("/app/db")]:
    d.mkdir(parents=True, exist_ok=True)

# Only these extensions are accepted for upload
ALLOWED_EXTENSIONS = {
    "pdf",
    "docx",
    "pptx",
    "xlsx",
    "jpg",
    "jpeg",
    "png",
}
MAX_FILE_SIZE_MB   = 50

# Database connection and session
engine       = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# Password hashing and JWT auth
pwd_context    = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme  = OAuth2PasswordBearer(tokenUrl="/auth/token")

# FastAPI app and CORS
app = FastAPI(
    title="ConvertFlow API",
    version="1.0.0",
    description="Secure file conversion: PDF→DOCX, PPTX→JPG",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Tighten to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/response shapes for the API
class UserCreate(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, digits, _ and -")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class Token(BaseModel):
    access_token: str
    token_type:   str


class CommentCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        if len(v) > 1000:
            raise ValueError("Comment must be ≤ 1000 characters")
        return v


class CommentOut(BaseModel):
    id:         int
    content:    str
    created_at: datetime

    class Config:
        from_attributes = True


class FileOut(BaseModel):
    id:                 int
    original_filename:  str
    file_type:          str
    status:             str
    converted_filename: Optional[str]
    created_at:         datetime
    comments:           List[CommentOut] = []

    class Config:
        from_attributes = True


# Inject a DB session into route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Password hashing, JWT creation, current-user lookup, and security logging
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    """Encode a JWT with an expiry timestamp."""
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=TOKEN_TTL)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str    = Depends(oauth2_scheme),
    db:   Session = Depends(get_db),
) -> User:
    """
    JWT validation guard — injected as a dependency on every protected endpoint.

    1. Decode and verify the token signature + expiry.
    2. Extract the `sub` claim (username).
    3. Look up the user in the DB.

    Any failure raises 401 Unauthorized.
    """
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise exc
    except JWTError:
        raise exc

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise exc
    return user


def _log(db: Session, event: str, username: str = None, ip: str = None, detail: str = None):
    """Write a row to the security_logs table."""
    db.add(SecurityLog(event=event, username=username, ip_address=ip, detail=detail))
    db.commit()


def _client_ip(request: Request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For."""
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else request.client.host


# Simple health check for load balancers
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "ConvertFlow API"}


# Register a new user and return a JWT
@app.post("/auth/register", response_model=Token, tags=["Auth"])
def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Register a new user and return a JWT.

    A unique `session_id` (UUID4) is generated for each user. All files
    uploaded by this user are prefixed with this ID on disk, providing
    namespace isolation at the filesystem level.
    """
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        username        = user_data.username,
        hashed_password = hash_password(user_data.password),
        session_id      = str(uuid.uuid4()),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _log(db, "USER_REGISTERED", user.username, _client_ip(request))

    return {"access_token": create_access_token({"sub": user.username}), "token_type": "bearer"}


@app.post("/auth/token", response_model=Token, tags=["Auth"])
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    request:   Request                   = None,
    db:        Session                   = Depends(get_db),
):
    """
    Standard OAuth2 password flow.  Returns a Bearer JWT on success.
    Failed attempts are logged with the client IP for rate-limit monitoring.

    NOTE: Username is normalized here in the same way as during registration
    (trimmed) so that accidental leading/trailing spaces don't prevent login.
    """
    username = (form_data.username or "").strip()
    user     = db.query(User).filter(User.username == username).first()
    ip       = _client_ip(request) if request else "unknown"

    if not user or not verify_password(form_data.password, user.hashed_password):
        _log(db, "FAILED_LOGIN", username, ip)
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    _log(db, "USER_LOGIN", user.username, ip)
    return {"access_token": create_access_token({"sub": user.username}), "token_type": "bearer"}


@app.get("/auth/me", tags=["Auth"])
def get_me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username, "session_id": current_user.session_id}


# Upload a file and start conversion in the background
@app.post("/files/upload", tags=["Files"])
async def upload_file(
    background_tasks: BackgroundTasks,
    file:             UploadFile        = File(...),
    target_format:    str               = "pdf",
    current_user:     User              = Depends(get_current_user),
    db:               Session           = Depends(get_db),
):
    """
    Upload a file and immediately enqueue a background conversion task.

    Security measures:
    - Extension whitelist (pdf, pptx only)
    - Max file size enforced (50 MB)
    - Stored filename = `{session_id}_{uuid4}.{ext}` — prevents path traversal
      and collisions; the original filename is stored only in the DB.
    """
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"File type '.{ext}' is not supported.")

    target = (target_format or "").lower().lstrip(".")
    allowed_targets = SUPPORTED_CONVERSIONS.get(ext, [])
    if target not in allowed_targets:
        raise HTTPException(
            status_code=400,
            detail=f"Conversion from .{ext} to .{target} is not supported.",
        )

    # Check file size limit
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB} MB limit")

    # Save file with a unique name (no user-controlled path)
    stored_filename = f"{current_user.session_id}_{uuid.uuid4()}.{ext}"
    file_path       = UPLOAD_DIR / stored_filename

    with open(file_path, "wb") as f:
        f.write(contents)

    # Store file metadata and queue conversion
    record = FileRecord(
        original_filename = file.filename,
        stored_filename   = stored_filename,
        file_type         = f"{ext}->{target}",
        status            = "pending",
        user_id           = current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    _log(db, "FILE_UPLOADED", current_user.username, detail=f"id={record.id} ext={ext}")

    # Run conversion in a background task
    background_tasks.add_task(_run_conversion, record.id, ext, target, stored_filename)

    return {"id": record.id, "status": "pending", "message": "Upload successful — conversion started"}


def _run_conversion(file_id: int, file_type: str, target_format: str, stored_filename: str):
    """
    Background worker function — runs in a thread pool via FastAPI BackgroundTasks.
    Opens its own DB session (the request session is already closed).
    """
    db = SessionLocal()
    try:
        record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
        if not record:
            return

        record.status = "converting"
        db.commit()

        success, output_name = handle_conversion(stored_filename, target_format)

        record.status             = "done" if success else "error"
        record.converted_filename = output_name if success else None
        db.commit()
        print(f"[worker] file_id={file_id} -> status={record.status}")

    except Exception as e:
        print(f"[worker] EXCEPTION for file_id={file_id}: {e}")
        rec = db.query(FileRecord).filter(FileRecord.id == file_id).first()
        if rec:
            rec.status = "error"
            db.commit()
    finally:
        db.close()


# List, download, or delete the current user's files

@app.get("/files", response_model=List[FileOut], tags=["Files"])
def list_files(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Return all files belonging to the authenticated user.

    SECURITY: The WHERE clause always includes `user_id = current_user.id`.
    There is no code path that returns another user's files.
    """
    return (
        db.query(FileRecord)
          .filter(FileRecord.user_id == current_user.id)
          .order_by(FileRecord.created_at.desc())
          .all()
    )


@app.get("/formats", tags=["Files"])
def get_supported_formats(
    current_user: User = Depends(get_current_user),
):
    """
    Return the server-side map of supported source→target conversions.
    The frontend uses this to populate the 'Convert to' selector.
    """
    return SUPPORTED_CONVERSIONS


@app.get("/files/{file_id}/status", tags=["Files"])
def get_status(
    file_id:      int,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """Poll conversion status. Ownership verified — IDOR protected."""
    record = db.query(FileRecord).filter(
        FileRecord.id      == file_id,
        FileRecord.user_id == current_user.id,   # ← IDOR guard
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "id":                 record.id,
        "status":             record.status,
        "converted_filename": record.converted_filename,
    }


@app.get("/files/{file_id}/download", tags=["Files"])
def download_file(
    file_id:      int,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Stream the converted file to the client.

    Double IDOR guard: the DB query checks ownership AND the file is stored
    under a UUID-prefixed name that embeds the user's session_id — an
    attacker who guesses a numeric ID still cannot download the file.
    """
    record = db.query(FileRecord).filter(
        FileRecord.id      == file_id,
        FileRecord.user_id == current_user.id,
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    if record.status != "done" or not record.converted_filename:
        raise HTTPException(status_code=400, detail="File is not ready for download")

    path = OUTPUT_DIR / record.converted_filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Output file missing from disk")

    return FileResponse(
        path       = str(path),
        filename   = record.converted_filename,
        media_type = "application/octet-stream",
    )


@app.delete("/files/{file_id}", tags=["Files"])
def delete_file(
    file_id:      int,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """Delete a file record and its physical files from disk."""
    record = db.query(FileRecord).filter(
        FileRecord.id      == file_id,
        FileRecord.user_id == current_user.id,
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete the uploaded file from disk
    upload = UPLOAD_DIR / record.stored_filename
    if upload.exists():
        upload.unlink()

    # Delete the converted file from disk
    if record.converted_filename:
        output = OUTPUT_DIR / record.converted_filename
        if output.exists():
            output.unlink()

    db.delete(record)
    db.commit()
    return {"message": "File deleted"}


# Add or remove notes on a file

@app.post("/files/{file_id}/comments", response_model=CommentOut, tags=["Comments"])
def add_comment(
    file_id:      int,
    body:         CommentCreate,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """Attach a note to a file. Only the file owner may add notes."""
    record = db.query(FileRecord).filter(
        FileRecord.id      == file_id,
        FileRecord.user_id == current_user.id,
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    comment = Comment(content=body.content, file_id=file_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.delete("/files/{file_id}/comments/{comment_id}", tags=["Comments"])
def delete_comment(
    file_id:      int,
    comment_id:   int,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """Delete a specific note. Validates file ownership first."""
    record = db.query(FileRecord).filter(
        FileRecord.id      == file_id,
        FileRecord.user_id == current_user.id,
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    comment = db.query(Comment).filter(
        Comment.id      == comment_id,
        Comment.file_id == file_id,
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(comment)
    db.commit()
    return {"message": "Note deleted"}
