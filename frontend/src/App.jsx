// src/App.jsx
// ─────────────────────────────────────────────────────────────────
//  Root component — handles Auth state.
//  If the user holds a valid JWT → render <FileConverter />
//  Otherwise                     → render <AuthPage />
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import axios from "axios";
import AuthPage       from "./components/AuthPage.jsx";
import FileConverter  from "./components/FileConverter.jsx";

// Point all API calls at the backend.
// In Docker: Nginx proxies /auth and /files to the backend container.
// In local dev: Vite's dev server proxy handles it (vite.config.js).
const API_BASE = import.meta.env.VITE_API_URL || "";

// Attach the JWT to every outgoing axios request automatically
axios.defaults.baseURL = API_BASE;

function App() {
  const [token,    setToken]    = useState(() => {
    const existing = localStorage.getItem("cf_token") || "";
    if (existing) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${existing}`;
    }
    return existing;
  });
  const [username, setUsername] = useState(() => localStorage.getItem("cf_user")  || "");

  // Inject the Authorization header whenever `token` changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const handleLogin = (newToken, user) => {
    // Immediately attach token so the very first /files request is authorized
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    localStorage.setItem("cf_token", newToken);
    localStorage.setItem("cf_user",  user);
    setToken(newToken);
    setUsername(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("cf_token");
    localStorage.removeItem("cf_user");
    setToken("");
    setUsername("");
  };

  return token
    ? <FileConverter username={username} onLogout={handleLogout} />
    : <AuthPage      onLogin={handleLogin} />;
}

export default App;
