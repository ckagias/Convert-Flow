# backend/models.py
# ─────────────────────────────────────────────────────────────────
#  SQLAlchemy ORM Models for ConvertFlow
#  Tables: users, files, comments, security_logs
# ─────────────────────────────────────────────────────────────────

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    """
    Represents an authenticated user.

    `session_id` is a UUID generated at registration time. All uploaded
    files are prefixed with this ID on disk, so even if a stored filename
    were guessed it would only resolve to *that* user's file.
    """
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(64), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    # Unique namespace for this user's files on disk
    session_id      = Column(String(36), unique=True, index=True, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)

    files = relationship("FileRecord", back_populates="owner", cascade="all, delete-orphan")


class FileRecord(Base):
    """
    Tracks every uploaded file and its conversion status.

    `stored_filename`   — the UUID-based name used on disk (not the original).
    `converted_filename`— set by the background worker once conversion completes.
    `status`            — one of: pending | converting | done | error
    """
    __tablename__ = "files"

    id                  = Column(Integer, primary_key=True, index=True)
    original_filename   = Column(String(256), nullable=False)   # What the user called it
    stored_filename     = Column(String(128), nullable=False)   # Safe UUID-prefixed disk name
    converted_filename  = Column(String(256), nullable=True)    # Output file name (set on success)
    file_type           = Column(String(8),   nullable=False)   # "pdf" | "pptx"
    status              = Column(String(16),  nullable=False, default="pending")
    user_id             = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at          = Column(DateTime, default=datetime.utcnow)

    owner    = relationship("User",    back_populates="files")
    comments = relationship("Comment", back_populates="file", cascade="all, delete-orphan",
                            order_by="Comment.created_at")


class Comment(Base):
    """
    Simple notes/reminders attached to a FileRecord.
    Allows users to annotate a file (e.g. "Final draft for the boss").
    """
    __tablename__ = "comments"

    id         = Column(Integer, primary_key=True, index=True)
    content    = Column(Text, nullable=False)
    file_id    = Column(Integer, ForeignKey("files.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("FileRecord", back_populates="comments")


class SecurityLog(Base):
    """
    Audit trail for security-relevant events:
    USER_REGISTERED, USER_LOGIN, FAILED_LOGIN, FILE_UPLOADED, etc.
    Stored in the DB for easy inspection via SQL.
    """
    __tablename__ = "security_logs"

    id         = Column(Integer, primary_key=True, index=True)
    event      = Column(String(64),  nullable=False)
    username   = Column(String(64),  nullable=True)
    ip_address = Column(String(45),  nullable=True)   # IPv6 can be up to 45 chars
    detail     = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
