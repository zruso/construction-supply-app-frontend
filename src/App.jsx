import React, { useEffect, useState } from "react";

// Prefer your env var if you’ve set it in Vercel; fallback to your backend URL.
const API_URL = import.meta.env.VITE_API_URL || "https://construction-supply-app-backend.onrender.com";

// Emoji constants (code points so they always show)
const ICON = {
  approve: "\u2705",          // ✅
  ordered: "\uD83D\uDCE6",    // 📦
  delivered: "\uD83D\uDE9A",  // 🚚
  reject: "\u274C",           // ❌
  edit: "\u270F\uFE0F",       // ✏️
  cancel: "\u274C",           // ❌
  photo: "\uD83D\uDCF7"       // 📸
};

export default function App() {
  // Sticky auth: seed from localStorage
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [role, setRole] = useState(() => localStorage.getItem("role") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Data / UI state
  const [requests, setRequests] = useState([]);
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("");
  const [project, setProject] = useState("");
  const [error, setError] = useState("");      // visible error banner
  const [loading, setLoading] = useState(false);

  // Keep auth sticky
  useEffect(() => {
    if (token) localStorage.setItem("token", token); else localStorage.removeItem("token");
    if (role) localStorage.setItem("role", role);     else localStorage.removeItem("role");
  }, [token, role]);

  // Helpers
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const login = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      // Safely parse JSON (avoid crashes on HTML error pages)
      let data = null;
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok || !data?.token) {
        throw new Error(data?.error || `Login failed (HTTP ${res.status})`);
      }
      setToken(data.token);
      setRole(data.role || "");
      await fetchRequests(data.token); // preload list
      setUsername(""); setPassword("");
    } catch (err) {
      setError(err.message || "Login failed");
      setToken(""); setRole("");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(""); setRole(""); setRequests([]);
    setUsername(""); setPassword("");
    setError("");
  };

  const fetchRequests = async (tkn = token) => {
    if (!tkn) return;
    setError("");
    try {
      const res = await fetch(`${API_URL}/requests`, { headers: { ...authHeaders, Authorization: `Bearer ${tkn}` } });
      let data = [];
      try { data = await res.json(); } catch { data = []; }
      if (!res.ok) throw new Error(data?.error || `Failed to load requests (HTTP ${res.status})`);
      if (!Array.isArray(data)) data = [];
      setRequests(data);
    } catch (err) {
      setError(err.message || "Failed to load requests");
      setRequests([]); // keep UI consistent
    }
  };

  const createRequest = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ item, quantity, project })
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data?.error || `Create failed (HTTP ${res.status})`);
      setItem(""); setQuantity(""); setProject("");
      await fetchRequests();
    } catch (err) {
      setError(err.message || "Failed to create request");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data?.error || `Update failed (HTTP ${res.status})`);
      await fetchRequests();
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load requests after login (and on refresh with sticky token)
  useEffect(() => {
    if (token) fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---------- UI ----------
  if (!token) {
    return (
      <div style={wrap}>
        <Card>
          <h2>Login</h2>
          <form onSubmit={login}>
            <input style={input} placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
            <input style={input} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
            <button style={btn} disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
          </form>
          {error && <div style={errBox}>{error}</div>}
        </Card>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <header style={header}>
        <h2>Construction Supply App</h2>
        <div>
          <span style={{marginRight: 12}}>Role: <b>{role}</b></span>
          <button style={btnSmall} onClick={logout}>Logout</button>
        </div>
      </header>

      {error && <div style={errBanner}>{error}</div>}

      {role === "worker" && (
        <Card>
          <h3>New Supply Request</h3>
          <div style={grid}>
            <input style={input} placeholder="Item" value={item} onChange={e=>setItem(e.target.value)} />
            <input style={input} type="number" placeholder="Quantity" value={quantity} onChange={e=>setQuantity(e.target.value)} />
            <input style={input} placeholder="Project" value={project} onChange={e=>setProject(e.target.value)} />
            <button style={btn} onClick={createRequest} disabled={loading}>{loading ? "Submitting..." : "Submit"}</button>
          </div>
        </Card>
      )}

      <Card>
        <div style={rowBetween}>
          <h3>{role === "manager" ? "All Requests" : "My Requests"}</h3>
          <button style={btnSmall} onClick={()=>fetchRequests()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
        </div>

        {(requests || []).length === 0 && <div style={{color:"#666"}}>No requests yet.</div>}

        {(requests || []).map(r => (
          <div key={r.id} style={reqRow}>
            <div>
              <div><b>{r.item}</b> • Qty {r.quantity} • Project {r.project}</div>
              <div style={{color:"#555"}}>Status: {r.status}</div>
              {r.notes && <div style={{color:"#555"}}>Notes: {r.notes}</div>}
            </div>

            {role === "manager" ? (
              <div style={btnGroup}>
                <button style={btnTiny} onClick={()=>updateStatus(r.id,"approved")}>{ICON.approve} Approve</button>
                <button style={btnTiny} onClick={()=>updateStatus(r.id,"ordered")}>{ICON.ordered} Ordered</button>
                <button style={btnTiny} onClick={()=>updateStatus(r.id,"delivered")}>{ICON.delivered} Delivered</button>
                <button style={btnTinyDanger} onClick={()=>updateStatus(r.id,"rejected")}>{ICON.reject} Reject</button>
              </div>
            ) : (
              r.status === "pending" && (
                <div style={btnGroup}>
                  <button style={btnTiny} onClick={()=>window.alert("Edit coming soon")}>{ICON.edit} Edit</button>
                  <button style={btnTinyDanger} onClick={()=>updateStatus(r.id,"canceled")}>{ICON.cancel} Cancel</button>
                  <button style={btnTiny} onClick={()=>window.alert("Photo upload coming soon")}>{ICON.photo} Upload</button>
                </div>
              )
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

/* --------- tiny UI helpers --------- */
function Card({ children }) {
  return <div style={{border:"1px solid #e5e7eb", borderRadius:12, padding:16, margin:"12px auto", maxWidth:900, boxShadow:"0 1px 2px rgba(0,0,0,0.05)"}}>{children}</div>;
}

const wrap = { maxWidth: 1000, margin: "20px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header = { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 8 };
const grid = { display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap: 8, alignItems: "center" };
const input = { padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:8, width:"100%" };
const btn = { padding:"10px 14px", border:"none", background:"#0d6efd", color:"#fff", borderRadius:8, cursor:"pointer" };
const btnSmall = { ...btn, padding:"6px 10px", borderRadius:6 };
const btnTiny = { ...btnSmall, fontSize:12, padding:"6px 8px" };
const btnTinyDanger = { ...btnTiny, background:"#dc2626" };
const btnGroup = { display:"flex", gap: 6, flexWrap:"wrap", justifyContent:"flex-end" };
const rowBetween = { display:"flex", alignItems:"center", justifyContent:"space-between" };
const reqRow = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f1f5f9", gap: 10 };
const errBox = { marginTop: 8, color: "#b00020" };
const errBanner = { margin:"8px 0", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA", padding:"8px 10px", borderRadius:8 };
