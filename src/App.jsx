import React, { useState, useEffect } from "react";

const API_URL = "https://construction-supply-app-backend.onrender.com";

function App() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [requests, setRequests] = useState([]);
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("");
  const [project, setProject] = useState("");

  const login = async () => {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) {
      setToken(data.token);
      setRole(data.role);
      fetchRequests(data.token);
    } else {
      alert(data.error || "Login failed");
    }
  };

  const fetchRequests = async (tokenParam = token) => {
    const res = await fetch(`${API_URL}/requests`, {
      headers: { Authorization: `Bearer ${tokenParam}` }
    });
    const data = await res.json();
    setRequests(data);
  };

  const createRequest = async () => {
    const res = await fetch(`${API_URL}/requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item, quantity, project })
    });
    const data = await res.json();
    if (data.message) {
      fetchRequests();
      setItem("");
      setQuantity("");
      setProject("");
    } else {
      alert(data.error || "Failed to create request");
    }
  };

  const updateStatus = async (id, status) => {
    const res = await fetch(`${API_URL}/requests/${id}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.message) {
      fetchRequests();
    } else {
      alert(data.error || "Failed to update status");
    }
  };

  if (!token) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>Login</h2>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>{role === "manager" ? "Manager Dashboard" : "Worker Dashboard"}</h2>

      {role === "worker" && (
        <div>
          <h3>Create Supply Request</h3>
          <input
            placeholder="Item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />
          <input
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <input
            placeholder="Project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
          <button onClick={createRequest}>Submit</button>
        </div>
      )}

      <h3>Requests</h3>
      {requests.map((req) => (
        <div key={req.id} style={{ border: "1px solid #ccc", margin: "10px", padding: "10px" }}>
          <p><strong>Item:</strong> {req.item}</p>
          <p><strong>Quantity:</strong> {req.quantity}</p>
          <p><strong>Project:</strong> {req.project}</p>
          <p><strong>Status:</strong> {req.status}</p>

          {role === "manager" && (
            <div>
              <button onClick={() => updateStatus(req.id, "approved")}>✅ Approve</button>
              <button onClick={() => updateStatus(req.id, "ordered")}>📦 Ordered</button>
              <button onClick={() => updateStatus(req.id, "delivered")}>🚚 Delivered</button>
              <button onClick={() => updateStatus(req.id, "rejected")}>❌ Reject</button>
            </div>
          )}

          {role === "worker" && req.status === "pending" && (
            <div>
              <button onClick={() => alert("Edit feature coming soon!")}>✏️ Edit</button>
              <button onClick={() => updateStatus(req.id, "canceled")}>❌ Cancel</button>
              <button onClick={() => alert("Photo upload coming soon!")}>📸 Upload Photo</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default App;
