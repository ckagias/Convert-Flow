# Database tables: users, files, comments, security_logs

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    """One user. session_id is used as a prefix for their files on disk."""
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(64), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    session_id      = Column(String(36), unique=True, index=True, nullable=False)  # Prefix for file paths
    created_at      = Column(DateTime, default=datetime.utcnow)

    files = relationship("FileRecord", back_populates="owner", cascade="all, delete-orphan")


class FileRecord(Base):
    """One uploaded file and its conversion status (pending / converting / done / error)."""
    __tablename__ = "files"

    id                  = Column(Integer, primary_key=True, index=True)
    original_filename   = Column(String(256), nullable=False)
    stored_filename     = Column(String(128), nullable=False)   # Safe name on disk
    converted_filename  = Column(String(256), nullable=True)    # Set when conversion finishes
    file_type           = Column(String(8),   nullable=False)   # e.g. "pdf->docx"
    status              = Column(String(16),  nullable=False, default="pending")
    user_id             = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at          = Column(DateTime, default=datetime.utcnow)

    owner    = relationship("User",    back_populates="files")
    comments = relationship("Comment", back_populates="file", cascade="all, delete-orphan",
                            order_by="Comment.created_at")


class Comment(Base):
    """A text note attached to a file."""
    __tablename__ = "comments"

    id         = Column(Integer, primary_key=True, index=True)
    content    = Column(Text, nullable=False)
    file_id    = Column(Integer, ForeignKey("files.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("FileRecord", back_populates="comments")


class SecurityLog(Base):
    """Log of auth and upload events (login, register, upload, etc.)."""
    __tablename__ = "security_logs"

    id         = Column(Integer, primary_key=True, index=True)
    event      = Column(String(64),  nullable=False)
    username   = Column(String(64),  nullable=True)
    ip_address = Column(String(45),  nullable=True)   # IPv6 can be up to 45 chars
    detail     = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
