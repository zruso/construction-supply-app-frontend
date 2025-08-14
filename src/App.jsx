import React, { useEffect, useState } from "react";

/** Configure in Vercel as VITE_API_URL, else fallback */
const API_URL = import.meta.env.VITE_API_URL || "https://construction-supply-app-backend.onrender.com";

const ICON = {
  approve: "\u2705",          // ✅
  ordered: "\uD83D\uDCE6",    // 📦
  delivered: "\uD83D\uDE9A",  // 🚚
  reject: "\u274C",           // ❌
  edit: "\u270F\uFE0F",       // ✏️
  cancel: "\u274C",           // ❌
  photo: "\uD83D\uDCF7",      // 📸
  escalate: "\uD83D\uDD3C"    // 🔼
};

export default function App() {
  // auth
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [role, setRole] = useState(() => localStorage.getItem("role") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // data
  const [requests, setRequests] = useState([]);
  const [ownerInbox, setOwnerInbox] = useState([]);

  // worker create
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("");
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");

  // worker edit
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ item: "", quantity: "", project: "", notes: "" });

  // admin
  const [complexes, setComplexes] = useState([]);
  const [users, setUsers] = useState([]);
  const [newComplexName, setNewComplexName] = useState("");
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "worker", complex_id: "" });

  // ui
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    token ? localStorage.setItem("token", token) : localStorage.removeItem("token");
    role ? localStorage.setItem("role", role) : localStorage.removeItem("role");
  }, [token, role]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // auth
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
      await preload(data.token, data.role);
    } catch (e2) {
      setError(e2.message || "Login failed");
      setToken(""); setRole("");
    } finally { setLoading(false); }
  };
  const logout = () => { setToken(""); setRole(""); setRequests([]); setOwnerInbox([]); setUsers([]); setComplexes([]); setError(""); };

  const preload = async (tkn, r) => {
    if ((r || role) === "owner") { await Promise.all([fetchOwnerInbox(tkn), fetchComplexes(tkn), fetchUsers(tkn)]); }
    else if ((r || role) === "manager") { await Promise.all([fetchRequests(tkn), fetchComplexes(tkn), fetchUsers(tkn)]); }
    else { await fetchRequests(tkn); }
  };

  // fetchers
  const fetchRequests = async (tkn = token) => {
    if (!tkn) return;
    setError("");
    try {
      const res = await fetch(`${API_URL}/requests`, { headers: { ...authHeaders, Authorization: `Bearer ${tkn}` } });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || `Failed to load requests (${res.status})`);
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message || "Failed to load requests"); setRequests([]); }
  };
  const fetchOwnerInbox = async (tkn = token) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/owner/requests?status=pending`, { headers: { ...authHeaders, Authorization: `Bearer ${tkn}` } });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || `Failed to load owner inbox (${res.status})`);
      setOwnerInbox(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message || "Failed to load owner inbox"); setOwnerInbox([]); }
  };
  const fetchComplexes = async (tkn = token) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/complexes`, { headers: { ...authHeaders, Authorization: `Bearer ${tkn}` } });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || `Failed to load complexes (${res.status})`);
      setComplexes(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length && !newUser.complex_id) {
        setNewUser(u => ({ ...u, complex_id: data[0].id }));
      }
    } catch (e) { setError(e.message || "Failed to load complexes"); setComplexes([]); }
  };
  const fetchUsers = async (tkn = token) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/users`, { headers: { ...authHeaders, Authorization: `Bearer ${tkn}` } });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || `Failed to load users (${res.status})`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message || "Failed to load users"); setUsers([]); }
  };

  useEffect(() => {
    if (!token) return;
    preload(token, role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  // worker actions
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
    } catch (e) { setError(e.message || "Failed to create request"); }
    finally { setLoading(false); }
  };
  const startEdit = (r) => { setEditingId(r.id); setEditForm({ item: r.item || "", quantity: String(r.quantity ?? ""), project: r.project || "", notes: r.notes || "" }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({ item: "", quantity: "", project: "", notes: "" }); };
  const saveEdit = async (id) => {
    setError(""); setLoading(true);
    try {
      const payload = {};
      if (editForm.item !== "") payload.item = editForm.item;
      if (editForm.quantity !== "") payload.quantity = Number(editForm.quantity);
      if (editForm.project !== "") payload.project = editForm.project;
      payload.notes = editForm.notes;
      const res = await fetch(`${API_URL}/requests/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Edit failed (${res.status})`);
      setEditingId(null); await fetchRequests();
    } catch (e) { setError(e.message || "Failed to edit request"); }
    finally { setLoading(false); }
  };
  const uploadPhoto = async (id, file) => {
    if (!file) return;
    setError(""); setLoading(true);
    try {
      const fd = new FormData(); fd.append("photo", file);
      const res = await fetch(`${API_URL}/requests/${id}/photo`, { method: "POST", headers: { ...authHeaders }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
      await fetchRequests();
    } catch (e) { setError(e.message || "Failed to upload photo"); }
    finally { setLoading(false); }
  };

  // manager actions
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
    } catch (e) { setError(e.message || "Failed to update status"); }
    finally { setLoading(false); }
  };
  const escalateToOwner = async (id) => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests/${id}/escalate`, { method: "PATCH", headers: { ...authHeaders } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Escalate failed (${res.status})`);
      await fetchRequests();
    } catch (e) { setError(e.message || "Failed to escalate"); }
    finally { setLoading(false); }
  };

  // owner actions
  const ownerDecision = async (id, decision) => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests/${id}/owner`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Owner action failed (${res.status})`);
      await fetchOwnerInbox();
    } catch (e) { setError(e.message || "Failed to record owner decision"); }
    finally { setLoading(false); }
  };

  // admin actions
  const createComplex = async () => {
    if (!newComplexName.trim()) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/complexes`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newComplexName.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Create complex failed (${res.status})`);
      setNewComplexName(""); await fetchComplexes();
    } catch (e) { setError(e.message || "Failed to create complex"); }
    finally { setLoading(false); }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) return;
    setError(""); setLoading(true);
    try {
      const body = { username: newUser.username, password: newUser.password };
      if (role === "owner") {
        body.role = newUser.role;
        if (newUser.role !== "owner") body.complex_id = Number(newUser.complex_id);
      } else {
        // manager: server forces role=worker and complex=manager's
      }
      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Create user failed (${res.status})`);
      setNewUser({ username: "", password: "", role: "worker", complex_id: complexes[0]?.id || "" });
      await fetchUsers();
    } catch (e) { setError(e.message || "Failed to create user"); }
    finally { setLoading(false); }
  };

  // UI: unauth
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

      {/* Admin Panel for Owner & Manager */}
      {(role === "owner" || role === "manager") && (
        <Card>
          <div style={rowBetween}>
            <h3>User / Complex Admin</h3>
            <button style={btnSmall} onClick={()=>{ fetchComplexes(); fetchUsers(); }} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {role === "owner" && (
            <div style={{marginBottom:12}}>
              <h4>Create Complex</h4>
              <div style={{display:"grid", gridTemplateColumns:"2fr auto", gap:8}}>
                <input style={input} placeholder="Complex name" value={newComplexName} onChange={e=>setNewComplexName(e.target.value)} />
                <button style={btnSmall} onClick={createComplex}>Add Complex</button>
              </div>
            </div>
          )}

          <div style={{marginBottom:12}}>
            <h4>Create {role === "owner" ? "User" : "Worker"}</h4>
            <div style={gridAdmin}>
              <input style={input} placeholder="Username" value={newUser.username} onChange={e=>setNewUser(u=>({...u, username: e.target.value}))}/>
              <input style={input} type="password" placeholder="Password" value={newUser.password} onChange={e=>setNewUser(u=>({...u, password: e.target.value}))}/>
              {role === "owner" ? (
                <>
                  <select style={input} value={newUser.role} onChange={e=>setNewUser(u=>({...u, role: e.target.value}))}>
                    <option value="worker">Worker</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                  <select style={input} value={newUser.complex_id} onChange={e=>setNewUser(u=>({...u, complex_id: e.target.value}))} disabled={newUser.role === "owner"}>
                    {complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <input style={{...input, background:"#f9fafb"}} value="worker" readOnly />
                  <input style={{...input, background:"#f9fafb"}} value={(complexes[0]?.name || "Your Complex")} readOnly />
                </>
              )}
              <button style={btnSmall} onClick={createUser}>Create</button>
            </div>
          </div>

          <div>
            <h4>Users {role === "owner" ? "(all)" : "(your complex)"}</h4>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    <th style={th}>ID</th><th style={th}>Username</th><th style={th}>Role</th><th style={th}>Complex ID</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u=>(
                    <tr key={u.id}>
                      <td style={td}>{u.id}</td>
                      <td style={td}>{u.username}</td>
                      <td style={td}>{u.role}</td>
                      <td style={td}>{u.complex_id ?? "—"}</td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td style={td} colSpan="4">No users yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* WORKER */}
      {role === "worker" && (
        <>
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

          <RequestList
            title="My Requests"
            role="worker"
            requests={requests}
            onRefresh={fetchRequests}
            onUpdateStatus={updateStatus}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            onUploadPhoto={uploadPhoto}
          />
        </>
      )}

      {/* MANAGER */}
      {role === "manager" && (
        <RequestList
          title="Complex Requests"
          role="manager"
          requests={requests}
          onRefresh={fetchRequests}
          onUpdateStatus={updateStatus}
          onEscalate={escalateToOwner}
        />
      )}

      {/* OWNER */}
      {role === "owner" && (
        <Card>
          <div style={rowBetween}>
            <h3>Owner Approval Inbox (Escalated)</h3>
            <button style={btnSmall} onClick={()=>fetchOwnerInbox()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {ownerInbox.length === 0 && <div style={{color:"#666"}}>No escalated requests.</div>}
          {ownerInbox.map((r) => (
            <div key={r.id} style={reqRow}>
              <div style={{flex:1}}>
                <div><b>{r.item}</b> • Qty {r.quantity} • Project {r.project}</div>
                <div style={{marginTop:4}}>
                  <StatusBadge status={r.status} />
                  <OwnerBadge ownerStatus={r.owner_status} />
                  {r.photo_url && (
                    <a href={`${API_URL}${r.photo_url}`} target="_blank" rel="noreferrer" style={{marginLeft:10}}>
                      {ICON.photo} View Photo
                    </a>
                  )}
                </div>
                {r.notes && <div style={{color:"#555", marginTop:4}}>Notes: {r.notes}</div>}
              </div>
              <div style={btnGroup}>
                <button style={btnTiny} onClick={()=>ownerDecision(r.id,"approved")}>{ICON.approve} Approve</button>
                <button style={btnTinyDanger} onClick={()=>ownerDecision(r.id,"rejected")}>{ICON.reject} Reject</button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function RequestList({
  title, role, requests, onRefresh, onUpdateStatus, onEscalate,
  onStartEdit, onCancelEdit, onSaveEdit, editingId, editForm, setEditForm, onUploadPhoto
}) {
  return (
    <Card>
      <div style={rowBetween}>
        <h3>{title}</h3>
        <button style={btnSmall} onClick={()=>onRefresh()}>Refresh</button>
      </div>

      {(!requests || requests.length === 0) && <div style={{color:"#666"}}>No requests yet.</div>}

      {requests.map((r) => {
        const pending = r.status === "pending";
        return (
          <div key={r.id} style={reqRow}>
            <div style={{flex:1}}>
              <div><b>{r.item}</b> • Qty {r.quantity} • Project {r.project}</div>
              <div style={{marginTop:4}}>
                <StatusBadge status={r.status} />
                <OwnerBadge ownerStatus={r.owner_status} />
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
                {r.owner_status === "none" && pending && (
                  <button style={btnTiny} onClick={()=>onEscalate(r.id)}>{ICON.escalate} Escalate</button>
                )}
                <button style={btnTiny} onClick={()=>onUpdateStatus(r.id,"approved")}>{ICON.approve} Approve</button>
                <button style={btnTiny} onClick={()=>onUpdateStatus(r.id,"ordered")}>{ICON.ordered} Ordered</button>
                <button style={btnTiny} onClick={()=>onUpdateStatus(r.id,"delivered")}>{ICON.delivered} Delivered</button>
                <button style={btnTinyDanger} onClick={()=>onUpdateStatus(r.id,"rejected")}>{ICON.reject} Reject</button>
              </div>
            )}

            {role === "worker" && pending && (
              <div style={btnGroup}>
                {editingId === r.id ? (
                  <>
                    <button style={btnTiny} onClick={()=>onSaveEdit(r.id)}>{ICON.edit} Save</button>
                    <button style={btnTinyDanger} onClick={onCancelEdit}>{ICON.cancel} Cancel Edit</button>
                  </>
                ) : (
                  <>
                    <button style={btnTiny} onClick={()=>onStartEdit(r)}>{ICON.edit} Edit</button>
                    <button style={btnTinyDanger} onClick={()=> window.confirm("Cancel this request?") && onUpdateStatus(r.id,"canceled")}>
                      {ICON.cancel} Cancel
                    </button>
                    <label style={{...btnTiny, display:"inline-block", cursor:"pointer"}}>
                      {ICON.photo} Upload
                      <input type="file" accept="image/*" style={{display:"none"}}
                             onChange={(e)=>onUploadPhoto(r.id, e.target.files?.[0])}/>
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {editingId && role === "worker" && (
        <div style={{marginTop:10, paddingTop:10, borderTop:"1px dashed #e5e7eb"}}>
          <h4>Edit Request</h4>
          <div style={grid}>
            <input style={input} placeholder="Item" value={editForm.item} onChange={e=>setEditForm(f=>({...f, item:e.target.value}))}/>
            <input style={input} type="number" placeholder="Quantity" value={editForm.quantity} onChange={e=>setEditForm(f=>({...f, quantity:e.target.value}))}/>
            <input style={input} placeholder="Project" value={editForm.project} onChange={e=>setEditForm(f=>({...f, project:e.target.value}))}/>
            <input style={input} placeholder="Notes" value={editForm.notes} onChange={e=>setEditForm(f=>({...f, notes:e.target.value}))}/>
          </div>
        </div>
      )}
    </Card>
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

function OwnerBadge({ ownerStatus }) {
  const s = String(ownerStatus || "").toLowerCase();
  const map = {
    none:     { bg:"#F3F4F6", fg:"#374151", label:"Owner: None" },
    pending:  { bg:"#FEF3C7", fg:"#92400E", label:"Owner: Pending" },
    approved: { bg:"#DCFCE7", fg:"#166534", label:`Owner: ${ICON.approve} Approved` },
    rejected: { bg:"#FEE2E2", fg:"#991B1B", label:`Owner: ${ICON.reject} Rejected` }
  };
  const c = map[s] || map.none;
  return <span style={{background:c.bg, color:c.fg, padding:"2px 8px", borderRadius:999, fontSize:12, marginLeft:8}}>{c.label}</span>;
}

/* ---- styles ---- */
const wrap = { maxWidth: 1200, margin: "20px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header = { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 8 };
const Card = ({children}) => <div style={{border:"1px solid #e5e7eb", borderRadius:12, padding:16, margin:"12px auto", maxWidth:1200, boxShadow:"0 1px 2px rgba(0,0,0,0.05)"}}>{children}</div>;
const grid = { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap: 8, alignItems:"center" };
const gridAdmin = { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr auto", gap: 8, alignItems:"center" };
const input = { padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:8, width:"100%" };
const btn = { padding:"10px 14px", border:"none", background:"#0d6efd", color:"#fff", borderRadius:8, cursor:"pointer" };
const btnSmall = { ...btn, padding:"6px 10px", borderRadius:6 };
const btnTiny = { ...btnSmall, fontSize:12, padding:"6px 8px" };
const btnTinyDanger = { ...btnTiny, background:"#dc2626" };
const btnGroup = { display:"flex", gap: 6, flexWrap:"wrap", justifyContent:"flex-end" };
const rowBetween = { display:"flex", alignItems:"center", justifyContent:"space-between" };
const reqRow = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f1f5f9", gap: 10 };
const errBanner = { margin:"8px 0", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA", padding:"8px 10px", borderRadius:8 };
