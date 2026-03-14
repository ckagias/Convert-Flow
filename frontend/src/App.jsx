// Chooses login page or main app based on whether the user has a saved token.

import { useState, useEffect } from "react";
import axios from "axios";
import AuthPage       from "./components/AuthPage.jsx";
import FileConverter  from "./components/FileConverter.jsx";

/* Base URL for API requests (Vite proxy or Nginx in production) */
const API_BASE = import.meta.env.VITE_API_URL || "";

/* Send all axios requests to the backend */
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

  /* Set the JWT on axios so every API call is authenticated */
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const handleLogin = (newToken, user) => {
    /* Use the new token for the next API call */
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
