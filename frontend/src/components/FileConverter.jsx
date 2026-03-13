// src/components/FileConverter.jsx
// ─────────────────────────────────────────────────────────────────
//  Main application view after login.
//    - Floating pill-shaped glassmorphism navbar
//    - Animated particle-network background
//    - Glassmorphism file cards
//    - Cyan accent colors
//
//  Features (logic unchanged):
//    • Drag-and-drop (+ click) file upload zone
//    • Live file list with status polling
//    • Per-file Notes (add / delete comments)
//    • Download button for completed conversions
//    • Delete file
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  LogOut, UploadCloud, FileText, Presentation, CheckCircle2,
  XCircle, Clock, RefreshCw, Download, Trash2, MessageSquarePlus,
  ChevronDown, ChevronUp, StickyNote, Loader2, FileStack, X
} from "lucide-react";
import ParticleBackground from "./ParticleBackground.jsx";

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_META = {
  pending:    { label: "Queued",      color: "text-amber-400  bg-amber-400/10  border-amber-400/20",  Icon: Clock },
  converting: { label: "Converting",  color: "text-cyan-400   bg-cyan-400/10   border-cyan-400/20",   Icon: Loader2 },
  done:       { label: "Ready",       color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", Icon: CheckCircle2 },
  error:      { label: "Failed",      color: "text-rose-400   bg-rose-400/10   border-rose-400/20",   Icon: XCircle },
};

function StatusBadge({ status }) {
  const { label, color, Icon } = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`status-badge border ${color}`}>
      <Icon size={11} className={status === "converting" ? "animate-spin" : ""} />
      {label}
    </span>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function FileTypeIcon({ type }) {
  if (type === "pdf")  return <FileText     size={16} className="text-rose-400 shrink-0" />;
  if (type === "pptx") return <Presentation size={16} className="text-amber-400 shrink-0" />;
  return <FileText size={16} className="text-slate-400 shrink-0" />;
}

// ── Notes sub-component ────────────────────────────────────────────────────────

function NotesSection({ file, onCommentAdded, onCommentDeleted }) {
  const [open,   setOpen]   = useState(false);
  const [draft,  setDraft]  = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const addNote = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.post(`/files/${file.id}/comments`, { content: draft.trim() });
      onCommentAdded(file.id, data);
      setDraft("");
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (commentId) => {
    try {
      await axios.delete(`/files/${file.id}/comments/${commentId}`);
      onCommentDeleted(file.id, commentId);
    } catch {
      // Silently fail
    }
  };

  const noteCount = file.comments?.length || 0;

  return (
    <div className="border-t border-white/5">
      {/* Toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-slate-500
                   hover:text-slate-300 hover:bg-white/5 transition-colors text-xs font-mono rounded-b-2xl"
      >
        <span className="flex items-center gap-1.5">
          <StickyNote size={12} />
          Notes
          {noteCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px]">
              {noteCount}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">

          {/* Existing notes */}
          {file.comments?.length > 0 ? (
            <ul className="space-y-2">
              {file.comments.map(c => (
                <li key={c.id} className="group flex items-start gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-slate-300 text-sm flex-1 leading-relaxed">{c.content}</span>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-slate-600 text-[10px] font-mono">{formatDate(c.created_at)}</span>
                    <button
                      onClick={() => deleteNote(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity btn-danger p-0 text-slate-600 hover:text-rose-400"
                      title="Delete note"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-600 text-xs font-mono italic">No notes yet.</p>
          )}

          {/* New note input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addNote()}
              placeholder="Add a note…  (Enter to save)"
              className="input-field text-xs py-2 flex-1"
              maxLength={1000}
            />
            <button
              onClick={addNote}
              disabled={saving || !draft.trim()}
              className="btn-primary px-3 py-2 text-xs"
              title="Add note"
            >
              {saving
                ? <Loader2 size={13} className="animate-spin" />
                : <MessageSquarePlus size={13} />
              }
            </button>
          </div>

          {error && (
            <p className="text-rose-400 text-xs">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}


// ── File Card ──────────────────────────────────────────────────────────────────

function FileCard({ file, onDelete, onCommentAdded, onCommentDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await axios.get(`/files/${file.id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data]);
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");

      a.href = url;
      a.download = file.converted_filename || file.original_filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${file.original_filename}"?`)) return;
    setDeleting(true);
    try {
      await axios.delete(`/files/${file.id}`);
      onDelete(file.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className={`card overflow-hidden animate-slide-up transition-all duration-200
                     ${deleting ? "opacity-40 pointer-events-none" : "hover:border-white/20 hover:shadow-[0_0_20px_-8px_rgba(34,211,238,0.15)]"}`}>

      {/* Card header */}
      <div className="p-4 flex items-start gap-3">
        <div className="mt-0.5">
          <FileTypeIcon type={file.file_type} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Filename */}
          <p className="font-mono text-sm text-slate-200 truncate" title={file.original_filename}>
            {file.original_filename}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <StatusBadge status={file.status} />
            <span className="text-slate-600 text-[11px] font-mono">{formatDate(file.created_at)}</span>
            <span className="text-slate-600 text-[10px] font-mono uppercase tracking-wider">
              {file.file_type} →{" "}
              {file.file_type === "pdf"  && "docx"}
              {file.file_type === "pptx" && "jpg / zip"}
            </span>
          </div>

          {/* Converting progress hint */}
          {file.status === "converting" && (
            <div className="mt-2 h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-cyan-400 rounded-full animate-pulse-slow" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {file.status === "done" && (
            <button
              onClick={handleDownload}
              className="btn-ghost px-2 py-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
              title="Download converted file"
            >
              <Download size={15} />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="btn-ghost px-2 py-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10"
            title="Delete file"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Notes section */}
      <NotesSection
        file={file}
        onCommentAdded={onCommentAdded}
        onCommentDeleted={onCommentDeleted}
      />
    </div>
  );
}


// ── Drop Zone ──────────────────────────────────────────────────────────────────

function DropZone({ onFilesSelected, uploading, accept }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDragOver  = e => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = e => { e.preventDefault(); setDragging(false); };
  const handleDrop      = e => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onFilesSelected(files);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`
        relative flex flex-col items-center justify-center gap-3
        border-2 border-dashed rounded-2xl p-10 cursor-pointer
        transition-all duration-200 select-none backdrop-blur-sm
        ${dragging
          ? "drop-zone-active"
          : "border-white/10 hover:border-white/25 hover:bg-white/5 bg-white/3"
        }
        ${uploading ? "cursor-wait opacity-60" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={e => onFilesSelected(Array.from(e.target.files))}
      />

      {/* Icon */}
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
                        border transition-colors
                        ${dragging
                          ? "bg-cyan-400/15 border-cyan-400/30"
                          : "bg-white/5 border-white/10"}`}>
        {uploading
          ? <Loader2 size={26} className="text-cyan-400 animate-spin" />
          : <UploadCloud size={26} className={dragging ? "text-cyan-400" : "text-slate-400"} />
        }
      </div>

      {/* Text */}
      <div className="text-center">
        <p className="font-sans text-sm font-medium text-slate-200">
          {uploading ? "Uploading…" : dragging ? "Drop to upload" : "Drop files here"}
        </p>
        <p className="text-slate-500 text-xs font-mono mt-1">
          Choose a file, then we&apos;ll convert it to your selected format.
        </p>
      </div>

      {!uploading && (
        <span className="text-xs text-slate-500 font-sans">
          or <span className="text-cyan-400 underline underline-offset-2">browse</span>
        </span>
      )}
    </div>
  );
}


// ── Main Component ─────────────────────────────────────────────────────────────

const DEFAULT_FORMATS = {
  pdf:  ["docx", "jpg", "png"],
  docx: ["pdf"],
  pptx: ["pdf", "jpg", "png"],
  xlsx: ["pdf"],
  jpg:  ["pdf", "png"],
  jpeg: ["pdf", "png"],
  png:  ["pdf", "jpg"],
};

export default function FileConverter({ username, onLogout }) {
  const [files,    setFiles]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [uploading,setUploading]= useState(false);
  const [errors,   setErrors]   = useState([]);
  const [formats,  setFormats]  = useState(DEFAULT_FORMATS);
  const [sourceExt,setSourceExt]= useState("pdf");
  const [targetExt,setTargetExt]= useState("docx");
  const pollRef = useRef(null);

  // ── Fetch file list ─────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    try {
      const { data } = await axios.get("/files");
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.response?.status === 401) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  // ── Fetch supported conversions ─────────────────────────────────
  useEffect(() => {
    const loadFormats = async () => {
      try {
        const { data } = await axios.get("/formats");
        const isObject =
          data && typeof data === "object" && !Array.isArray(data);
        const entries = isObject ? Object.entries(data) : [];
        const valid =
          isObject &&
          entries.length > 0 &&
          entries.every(
            ([key, val]) =>
              typeof key === "string" &&
              Array.isArray(val) &&
              val.every(v => typeof v === "string")
          );

        if (valid) {
          setFormats(data);
          const sources = Object.keys(data);
          const firstSource = sources[0];
          const firstTarget =
            (Array.isArray(data[firstSource]) && data[firstSource][0]) || "pdf";
          setSourceExt(firstSource);
          setTargetExt(firstTarget);
        }
      } catch {
        // Fall back to DEFAULT_FORMATS
      }
    };
    loadFormats();
  }, []);

  // ── Initial load + polling ──────────────────────────────────────
  useEffect(() => {
    fetchFiles();
    pollRef.current = setInterval(fetchFiles, 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchFiles]);

  // ── Upload handler ──────────────────────────────────────────────
  const handleFilesSelected = async (rawFiles) => {
    const valid = rawFiles.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["pdf","docx","pptx","xlsx","jpg","jpeg","png"].includes(ext || "");
    });

    const invalid = rawFiles.filter(f => !valid.includes(f));
    if (invalid.length) {
      setErrors(invalid.map(f => `"${f.name}" is not a supported file type.`));
      setTimeout(() => setErrors([]), 4000);
    }
    if (!valid.length) return;

    setUploading(true);
    const newErrors = [];

    for (const file of valid) {
      const form = new FormData();
      form.append("file", file);
      const ext = file.name.split(".").pop()?.toLowerCase();

      const src = ext && formats[ext] ? ext : sourceExt;
      const allowedTargets = formats[src] || [];
      let chosenTarget = targetExt;
      if (!allowedTargets.includes(chosenTarget) && allowedTargets.length) {
        chosenTarget = allowedTargets[0];
      }

      try {
        await axios.post(`/files/upload?target_format=${encodeURIComponent(chosenTarget)}`, form);
      } catch (e) {
        const msg = e.response?.data?.detail || `Failed to upload "${file.name}"`;
        newErrors.push(msg);
      }
    }

    setUploading(false);
    if (newErrors.length) {
      setErrors(newErrors);
      setTimeout(() => setErrors([]), 5000);
    }

    fetchFiles();
  };

  // ── Comment callbacks ───────────────────────────────────────────
  const handleCommentAdded = (fileId, comment) => {
    setFiles(prev => prev.map(f =>
      f.id === fileId
        ? { ...f, comments: [...(f.comments || []), comment] }
        : f
    ));
  };

  const handleCommentDeleted = (fileId, commentId) => {
    setFiles(prev => prev.map(f =>
      f.id === fileId
        ? { ...f, comments: f.comments.filter(c => c.id !== commentId) }
        : f
    ));
  };

  // ── Delete callback ─────────────────────────────────────────────
  const handleDelete = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // ── Derived state ───────────────────────────────────────────────
  const activeJobs = files.filter(f => f.status === "pending" || f.status === "converting").length;

  const acceptExtensions = Object.keys(formats).length
    ? Object.keys(formats).map(ext => `.${ext}`).join(",")
    : ".pdf,.pptx,.docx,.xlsx,.jpg,.jpeg,.png";

  const sourceOptions = Array.isArray(formats)
    ? []
    : Object.keys(formats || {});
  const targetOptions = Array.isArray(formats?.[sourceExt])
    ? formats[sourceExt]
    : [];

  return (
    <div className="min-h-dvh flex flex-col">

      {/* ── Particle background (fixed, behind everything) ──────── */}
      <ParticleBackground />

      {/* ── Floating Pill Navbar ─────────────────────────────────── */}
      <header className="py-5 sticky top-0 z-50 pointer-events-none">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-center pointer-events-auto">

          {/* Pill nav shell */}
          <nav className="flex items-center gap-2 bg-white/5 backdrop-blur-xl px-3 py-2 rounded-full
                          border border-white/10 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.6)]
                          w-full max-w-2xl justify-between">

            {/* Logo */}
            <div className="flex items-center gap-2 pl-1">
              <div className="w-6 h-6 bg-cyan-400/15 border border-cyan-400/30 rounded-lg
                              flex items-center justify-center">
                <FileStack size={13} className="text-cyan-400" />
              </div>
              <span className="font-sans font-bold text-white text-sm">
                <span className="text-cyan-400">Convert</span>Flow
              </span>
            </div>

            {/* Right side: active jobs + user + logout */}
            <div className="flex items-center gap-3 pr-1">
              {activeJobs > 0 && (
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono animate-pulse-slow">
                  <RefreshCw size={11} className="animate-spin-slow" />
                  {activeJobs} converting
                </div>
              )}

              {/* User avatar */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/10 border border-white/15
                                flex items-center justify-center">
                  <span className="text-[10px] font-mono text-slate-300 uppercase">
                    {username?.[0] || "?"}
                  </span>
                </div>
                <span className="text-slate-400 text-xs font-mono hidden sm:block">{username}</span>
              </div>

              <button
                onClick={onLogout}
                className="btn-ghost px-2 py-1.5 text-slate-500 hover:text-slate-300"
                title="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-4 pb-12 space-y-6 relative z-10">

        {/* Conversion selector + drop zone */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <div className="text-xs text-slate-500 font-mono">
              Choose how you want to convert your next upload.
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-mono">Convert</span>
              <select
                className="input-field px-2 py-1 text-xs w-20"
                value={sourceExt}
                onChange={e => {
                  const src = e.target.value;
                  setSourceExt(src);
                  const allowed = formats[src] || [];
                  if (allowed.length && !allowed.includes(targetExt)) {
                    setTargetExt(allowed[0]);
                  }
                }}
              >
                {sourceOptions.map(src => (
                  <option key={src} value={src}>.{src}</option>
                ))}
              </select>
              <span className="text-slate-500 font-mono">to</span>
              {targetOptions.length > 0 && (
                <select
                  className="input-field px-2 py-1 text-xs w-20"
                  value={targetExt}
                  onChange={e => setTargetExt(e.target.value)}
                >
                  {targetOptions.map(tgt => (
                    <option key={tgt} value={tgt}>.{tgt}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <DropZone
            onFilesSelected={handleFilesSelected}
            uploading={uploading}
            accept={acceptExtensions}
          />

          {/* Upload errors */}
          {errors.length > 0 && (
            <div className="mt-3 space-y-1.5 animate-fade-in">
              {errors.map((e, i) => (
                <p key={i} className="text-rose-400 text-xs font-mono flex items-center gap-1.5">
                  <XCircle size={11} /> {e}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* Divider + count */}
        {!loading && files.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-slate-600 text-xs font-mono">
              {files.length} file{files.length !== 1 ? "s" : ""}
            </span>
            <div className="flex-1 h-px bg-white/8" />
          </div>
        )}

        {/* File list */}
        <section className="space-y-3">
          {loading ? (
            [0, 1, 2].map(i => (
              <div key={i} className="card p-4 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            ))
          ) : files.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10
                              flex items-center justify-center mb-4">
                <UploadCloud size={28} className="text-slate-500" />
              </div>
              <p className="font-sans text-slate-400 font-medium mb-1">No files yet</p>
              <p className="text-slate-600 text-sm font-mono">Upload a file to get started</p>
            </div>
          ) : (
            files.map(file => (
              <FileCard
                key={file.id}
                file={file}
                onDelete={handleDelete}
                onCommentAdded={handleCommentAdded}
                onCommentDeleted={handleCommentDeleted}
              />
            ))
          )}
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="relative z-10 mt-auto">
        <div className="max-w-3xl mx-auto px-4">
          <div className="py-6 border-t border-white/8 flex flex-col md:flex-row
                          justify-between items-center text-xs text-slate-500 gap-4">
            <div className="font-medium tracking-wide">
              <span className="text-cyan-400 font-bold">Convert</span>Flow &copy; 2026 | All rights reserved
            </div>
            <div>
              Developed &amp; Designed by{" "}
              <a
                href="https://github.com/ckagias"
                target="_blank"
                rel="noreferrer"
                className="text-slate-300 hover:text-cyan-400 transition-colors font-bold hover:underline"
              >
                Christoforos Kagias
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
