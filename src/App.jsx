import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://construction-supply-app-backend.onrender.com";

// Emoji via code points (reliable)
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
  // sticky auth
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [role, setRole] = useState(() => localStorage.getItem("role") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // data
  const [requests, setRequests] = useState([]);
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("");
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");

  // edit & upload
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ item: "", quantity: "", project: "", notes: "" });

  // UI
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    token ? localStorage.setItem("token", token) : localStorage.removeItem("token");
    role ? localStorage.setItem("role", role) : localStorage.removeItem("role");
  }, [token, role]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const login = async (e) => {
    e?.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data?.error || `Login failed (${res.status})`);
      setToken(data.token);
      setRole(data.role || "");
      setUsername(""); setPassword("");
      await fetchRequests(data.token);
    } catch (e) {
      setError(e.message || "Login failed");
      setToken(""); setRole("");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(""); setRole(""); setRequests([]); setError("");
  };

  const fetchRequests = async (tkn = token) => {
    if (!tkn) return;
    setError("");
    try {
      const res = await fetch(`${API_URL}/requests`, { headers: { ...authHeaders, Authorization: `Bearer ${tkn}` }});
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || `Failed to load requests (${res.status})`);
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load requests");
      setRequests([]);
    }
  };

  useEffect(() => { if (token) fetchRequests(); /* eslint-disable-next-line */ }, [token]);

  const createRequest = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ item, quantity, project, notes })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Create failed (${res.status})`);
      setItem(""); setQuantity(""); setProject(""); setNotes("");
      await fetchRequests();
    } catch (e) {
      setError(e.message || "Failed to create request");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`);
      await fetchRequests();
    } catch (e) {
      setError(e.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  // worker editing
  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({
      item: r.item || "",
      quantity: String(r.quantity ?? ""),
      project: r.project || "",
      notes: r.notes || ""
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm({ item:"", quantity:"", project:"", notes:"" }); };
  const saveEdit = async (id) => {
    setError(""); setLoading(true);
    try {
      const payload = {};
      if (editForm.item !== "") payload.item = editForm.item;
      if (editForm.quantity !== "") payload.quantity = Number(editForm.quantity);
      if (editForm.project !== "") payload.project = editForm.project;
      payload.notes = editForm.notes; // allow blank
      const res = await fetch(`${API_URL}/requests/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Edit failed (${res.status})`);
      setEditingId(null);
      await fetchRequests();
    } catch (e) {
      setError(e.message || "Failed to edit request");
    } finally {
      setLoading(false);
    }
  };

  // worker photo upload
  const uploadPhoto = async (id, file) => {
    if (!file) return;
    setError(""); setLoading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch(`${API_URL}/requests/${id}/photo`, {
        method: "POST",
        headers: { ...authHeaders }, // no manual content-type
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
      await fetchRequests();
    } catch (e) {
      setError(e.message || "Failed to upload photo");
    } finally {
      setLoading(false);
    }
  };

  // ---- UI ----
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
          {error && <div style={errBanner}>{error}</div>}
        </Card>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <header style={header}>
        <h2>Construction Supply App</h2>
        <div>
          <span style={{marginRight:12}}>Role: <b>{role}</b></span>
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
            <input style={input} placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} />
            <button style={btn} onClick={createRequest} disabled={loading}>{loading ? "Submitting..." : "Submit"}</button>
          </div>
        </Card>
      )}

      <Card>
        <div style={rowBetween}>
          <h3>{role === "manager" ? "All Requests" : "My Requests"}</h3>
          <button style={btnSmall} onClick={()=>fetchRequests()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
        </div>

        {requests.length === 0 && <div style={{color:"#666"}}>No requests yet.</div>}

        {requests.map((r) => {
          const pending = r.status === "pending";
          return (
            <div key={r.id} style={reqRow}>
              <div style={{flex:1}}>
                <div><b>{r.item}</b> • Qty {r.quantity} • Project {r.project}</div>
                <div style={{marginTop:4}}>
                  <StatusBadge status={r.status} />
                  {r.photo_url && (
                    <a href={`${API_URL}${r.photo_url}`} target="_blank" rel="noreferrer" style={{marginLeft:10}}>
                      {ICON.photo} View Photo
                    </a>
                  )}
                </div>
                {r.notes && <div style={{color:"#555", marginTop:4}}>Notes: {r.notes}</div>}
              </div>

              {role === "manager" && (
                <div style={btnGroup}>
                  <button style={btnTiny} onClick={()=>updateStatus(r.id,"approved")}>{ICON.approve} Approve</button>
                  <button style={btnTiny} onClick={()=>updateStatus(r.id,"ordered")}>{ICON.ordered} Ordered</button>
                  <button style={btnTiny} onClick={()=>updateStatus(r.id,"delivered")}>{ICON.delivered} Delivered</button>
                  <button style={btnTinyDanger} onClick={()=>updateStatus(r.id,"rejected")}>{ICON.reject} Reject</button>
                </div>
              )}

              {role === "worker" && pending && (
                <div style={btnGroup}>
                  {editingId === r.id ? (
                    <>
                      <button style={btnTiny} onClick={()=>saveEdit(r.id)}>{ICON.edit} Save</button>
                      <button style={btnTinyDanger} onClick={cancelEdit}>{ICON.cancel} Cancel Edit</button>
                    </>
                  ) : (
                    <>
                      <button style={btnTiny} onClick={()=>startEdit(r)}>{ICON.edit} Edit</button>
                      <button
                        style={btnTinyDanger}
                        onClick={()=> window.confirm("Cancel this request?") && updateStatus(r.id,"canceled")}
                      >
                        {ICON.cancel} Cancel
                      </button>
                      <label style={{...btnTiny, display:"inline-block", cursor:"pointer"}}>
                        {ICON.photo} Upload
                        <input type="file" accept="image/*" style={{display:"none"}}
                               onChange={(e)=>uploadPhoto(r.id, e.target.files?.[0])}/>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {editingId && (
          <div style={{marginTop:10, paddingTop:10, borderTop:"1px dashed #e5e7eb"}}>
            <h4>Edit Request</h4>
            <div style={grid}>
              <input style={input} placeholder="Item" value={editForm.item} onChange={e=>setEditForm(f=>({...f, item:e.target.value}))} />
              <input style={input} type="number" placeholder="Quantity" value={editForm.quantity} onChange={e=>setEditForm(f=>({...f, quantity:e.target.value}))} />
              <input style={input} placeholder="Project" value={editForm.project} onChange={e=>setEditForm(f=>({...f, project:e.target.value}))} />
              <input style={input} placeholder="Notes" value={editForm.notes} onChange={e=>setEditForm(f=>({...f, notes:e.target.value}))} />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    pending:  { bg:"#FEF3C7", fg:"#92400E", label:"Pending" },
    approved: { bg:"#DCFCE7", fg:"#166534", label:`${ICON.approve} Approved` },
    ordered:  { bg:"#DBEAFE", fg:"#1E40AF", label:`${ICON.ordered} Ordered` },
    delivered:{ bg:"#E0E7FF", fg:"#3730A3", label:`${ICON.delivered} Delivered` },
    rejected: { bg:"#FEE2E2", fg:"#991B1B", label:`${ICON.reject} Rejected` },
    canceled: { bg:"#F3F4F6", fg:"#374151", label:"Canceled" }
  };
  const c = map[s] || map.pending;
  return <span style={{background:c.bg, color:c.fg, padding:"2px 8px", borderRadius:999, fontSize:12}}>{c.label}</span>;
}

/* ---- styles ---- */
const wrap = { maxWidth: 1000, margin: "20px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header = { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 8 };
const Card = ({children}) => <div style={{border:"1px solid #e5e7eb", borderRadius:12, padding:16, margin:"12px auto", maxWidth:1000, boxShadow:"0 1px 2px rgba(0,0,0,0.05)"}}>{children}</div>;
const grid = { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap: 8, alignItems:"center" };
const input = { padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:8, width:"100%" };
const btn = { padding:"10px 14px", border:"none", background:"#0d6efd", color:"#fff", borderRadius:8, cursor:"pointer" };
const btnSmall = { ...btn, padding:"6px 10px", borderRadius:6 };
const btnTiny = { ...btnSmall, fontSize:12, padding:"6px 8px" };
const btnTinyDanger = { ...btnTiny, background:"#dc2626" };
const btnGroup = { display:"flex", gap: 6, flexWrap:"wrap", justifyContent:"flex-end" };
const rowBetween = { display:"flex", alignItems:"center", justifyContent:"space-between" };
const reqRow = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f1f5f9", gap: 10 };
const errBanner = { margin:"8px 0", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA", padding:"8px 10px", borderRadius:8 };
