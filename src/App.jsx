import React, { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post(`${API_URL}/login`, { username, password });
      setToken(res.data.token);
      setRole(res.data.role);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    }
  };

  const logout = () => {
    setToken("");
    setRole("");
    setUsername("");
    setPassword("");
  };

  // Worker dashboard
  const WorkerDashboard = () => (
    <div>
      <h2>Worker Dashboard</h2>
      <p>Here you can submit supply requests.</p>
      <button onClick={logout}>Logout</button>
    </div>
  );

  // Manager dashboard
  const ManagerDashboard = () => (
    <div>
      <h2>Manager Dashboard</h2>
      <p>Here you can view and approve supply requests.</p>
      <button onClick={logout}>Logout</button>
    </div>
  );

  // Show login form if no token
  if (!token) {
    return (
      <div style={{ maxWidth: 300, margin: "50px auto" }}>
        <h2>Login</h2>
        <form onSubmit={login}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <button type="submit" style={{ width: "100%" }}>Login</button>
        </form>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );
  }

  // Show correct dashboard
  if (role === "worker") return <WorkerDashboard />;
  if (role === "manager") return <ManagerDashboard />;
  return <p>Unknown role</p>;
}
