// src/components/AuthPage.jsx
// ─────────────────────────────────────────────────────────────────
//  Login / Register page — redesigned to match MC Patras dashboard.
//  Glassmorphism card, particle-network background, cyan accent.
//  Logic is unchanged.
// ─────────────────────────────────────────────────────────────────

import { useState } from "react";
import axios from "axios";
import { ArrowRight, Lock, User, FileStack, AlertCircle } from "lucide-react";
import ParticleBackground from "./ParticleBackground.jsx";

export default function AuthPage({ onLogin }) {
  const [mode,     setMode]     = useState("login");   // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const isRegister = mode === "register";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        const { data } = await axios.post("/auth/register", { username, password });
        onLogin(data.access_token, username);
      } else {
        const form = new URLSearchParams();
        form.append("username", username);
        form.append("password", password);
        const { data } = await axios.post("/auth/token", form, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        onLogin(data.access_token, username);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Something went wrong. Please try again.";
      setError(Array.isArray(msg) ? msg[0]?.msg || "Validation error" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Animated particle-network background */}
      <ParticleBackground />

      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-10 animate-fade-in">
        <div className="w-10 h-10 bg-cyan-400/10 border border-cyan-400/30 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <FileStack size={20} className="text-cyan-400" />
        </div>
        <span className="font-sans text-2xl font-bold text-white tracking-tight">
          <span className="text-cyan-400">Convert</span>Flow
        </span>
      </div>

      {/* ── Auth Card ─────────────────────────────────────────── */}
      <div className="card w-full max-w-sm p-8 animate-slide-up shadow-2xl shadow-black/50">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-sans text-xl font-semibold text-white mb-1">
            {isRegister ? "Create an account" : "Welcome back"}
          </h1>
          <p className="text-slate-400 text-sm">
            {isRegister
              ? "Start converting your files securely."
              : "Sign in to access your files."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-500 mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                className="input-field pl-9"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-500 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                className="input-field pl-9"
                placeholder={isRegister ? "min. 8 characters" : "••••••••"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm animate-fade-in">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-primary w-full justify-center mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin-slow" />
                {isRegister ? "Creating account…" : "Signing in…"}
              </span>
            ) : (
              <>
                {isRegister ? "Create account" : "Sign in"}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <span className="text-slate-500 text-sm">
            {isRegister ? "Already have an account? " : "Don't have an account? "}
          </span>
          <button
            onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); }}
            className="text-cyan-400 text-sm hover:text-cyan-300 font-medium transition-colors"
          >
            {isRegister ? "Sign in" : "Register"}
          </button>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-8 text-slate-600 text-xs font-mono text-center animate-fade-in">
        Files are scoped to your session — nobody else can see your uploads.
      </p>
    </div>
  );
}
