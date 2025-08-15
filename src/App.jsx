import React, { useEffect, useState } from "react";

/** =========================
 *  Config
 *  ========================= */
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://construction-supply-app-backend.onrender.com";

const ROLE_LABEL = { owner: "Owner", manager: "Supervisor", worker: "Employee" };
const toLabel = (code) => ROLE_LABEL[code] || code;

const ICON = {
  approve: "\u2705",
  ordered: "\uD83D\uDCE6",
  delivered: "\uD83D\uDE9A",
  reject: "\u274C",
  edit: "\u270F\uFE0F",
  cancel: "\u274C",
  photo: "\uD83D\uDCF7",
  escalate: "\uD83D\uDD3C"
};

/** =========================
 *  Error Boundary
 *  ========================= */
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError:false, err:null }; }
  static getDerivedStateFromError(error){ return { hasError:true, err:error }; }
  componentDidCatch(error, info){ console.error("UI crashed:", error, info); }
  render(){
    if (this.state.hasError) {
      return (
        <div style={wrap}>
          <div style={errBanner}>
            <b>Something went wrong in the UI.</b><br/>
            {String(this.state.err?.message || this.state.err || "Unknown error")}
            <div style={{ marginTop:8 }}>
              <button style={btnSmall} onClick={()=>window.location.reload()}>Reload</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** =========================
 *  App
 *  ========================= */
export default function App() {
  // Hash route for invite accept (use hash so Vercel doesn't 404)
  const [inviteToken, setInviteToken] = useState(readInviteFromHash());
  useEffect(() => {
    const onHash = () => setInviteToken(readInviteFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (inviteToken) return (
    <ErrorBoundary>
      <AcceptInvite token={inviteToken} />
    </ErrorBoundary>
  );

  // Auth
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [role, setRole] = useState(() => localStorage.getItem("role") || "");
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [loginRole, setLoginRole] = useState("worker"); // owner|manager|worker
  const [me, setMe] = useState(null);

  // Data
  const [requests, setRequests] = useState([]);
  const [ownerInbox, setOwnerInbox] = useState([]);

  // Worker form
  const [item, setItem] = useState(""); const [quantity, setQuantity] = useState("");
  const [project, setProject] = useState(""); const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ item: "", quantity: "", project: "", notes: "" });

  // Admin
  const [complexes, setComplexes] = useState([]);
  const [users, setUsers] = useState([]);
  const [newComplexName, setNewComplexName] = useState("");

  // Owner invite form
  const [ownerInvite, setOwnerInvite] = useState({ username: "", role: "manager", complex_id: "" });
  // Supervisor invite
  const [superInvite, setSuperInvite] = useState({ username: "" });
  const [lastInviteLink, setLastInviteLink] = useState("");

  // Owner tabs
  const [ownerTab, setOwnerTab] = useState("inbox");

  // UI
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  useEffect(() => {
    token ? localStorage.setItem("token", token) : localStorage.removeItem("token");
    role ? localStorage.setItem("role", role) : localStorage.removeItem("role");
  }, [token, role]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchMe = async (tkn = token) => {
    if (!tkn) return;
    try {
      const res = await fetch(`${API_URL}/me`, { headers: { ...authHeaders, Authorization: `Bearer ${tkn}` } });
      const data = await res.json().catch(()=>null);
      if (res.ok && data) setMe(data); else setMe(null);
    } catch { setMe(null); }
  };

  const login = async (e) => {
    e?.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok || !data.token) throw new Error(data?.error || `Login failed (${res.status})`);
      const actualRole = String(data.role || "").toLowerCase();
      if (actualRole !== loginRole) throw new Error(`This account is ${toLabel(actualRole)}. Switch selector to ${toLabel(actualRole)}.`);
      setToken(data.token); setRole(actualRole); setUsername(""); setPassword("");
      await preload(data.token, actualRole);
    } catch (e2) {
      setError(e2.message || "Login failed"); setToken(""); setRole(""); setMe(null);
    } finally { setLoading(false); }
  };

  const logout = () => {
    setToken(""); setRole(""); setMe(null);
    setRequests([]); setOwnerInbox([]); setUsers([]); setComplexes([]);
    setError(""); setOwnerTab("inbox");
  };

  const preload = async (tkn, r) => {
    await fetchMe(tkn);
    if (r === "owner") {
      await Promise.all([fetchOwnerInbox(tkn), fetchRequests(tkn), fetchComplexes(tkn), fetchUsers(tkn)]);
    } else if (r === "manager") {
      await Promise.all([fetchRequests(tkn), fetchComplexes(tkn), fetchUsers(tkn)]);
    } else {
      await fetchRequests(tkn);
    }
  };

  const fetchRequests = async (tkn = token) => {
    if (!tkn) return; setError("");
    try {
      const res = await fetch(`${API_URL}/requests`, { headers: { ...authHeaders, Authorization: `Bearer ${tkn}` }});
      const data = await res.json().catch(()=>[]);
      setRequests(Array.isArray(data) ? data : []);
      if (!res.ok) throw new Error(data?.error || `Failed to load requests (${res.status})`);
    } catch (e) { console.error(e); setError(e.message || "Failed to load requests"); setRequests([]); }
  };

  const fetchOwnerInbox = async (tkn = token) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/owner/requests?status=pending`, { headers: { ...authHeaders, Authorization:`Bearer ${tkn}` }});
      const data = await res.json().catch(()=>[]);
      setOwnerInbox(Array.isArray(data) ? data : []);
      if (!res.ok) throw new Error(data?.error || `Failed to load owner inbox (${res.status})`);
    } catch (e) { console.error(e); setError(e.message || "Failed to load owner inbox"); setOwnerInbox([]); }
  };

  const fetchComplexes = async (tkn = token) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/complexes`, { headers: { ...authHeaders, Authorization:`Bearer ${tkn}` }});
      const data = await res.json().catch(()=>[]);
      const arr = Array.isArray(data) ? data : [];
      setComplexes(arr);
      // set default complex id safely
      if (arr.length && !ownerInvite.complex_id) {
        setOwnerInvite((v) => ({ ...v, complex_id: String(arr[0].id) }));
      }
      if (!res.ok) throw new Error(data?.error || `Failed to load complexes (${res.status})`);
    } catch (e) { console.error(e); setError(e.message || "Failed to load complexes"); setComplexes([]); }
  };

  const fetchUsers = async (tkn = token) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/users`, { headers: { ...authHeaders, Authorization:`Bearer ${tkn}` }});
      const data = await res.json().catch(()=>[]);
      setUsers(Array.isArray(data) ? data : []);
      if (!res.ok) throw new Error(data?.error || `Failed to load users (${res.status})`);
    } catch (e) { console.error(e); setError(e.message || "Failed to load users"); setUsers([]); }
  };

  useEffect(() => {
    if (!token) return;
    preload(token, role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  /** -------- Employee actions -------- */
  const createRequest = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests`, {
        method:"POST", headers:{ ...authHeaders, "Content-Type":"application/json" },
        body: JSON.stringify({ item, quantity, project, notes })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Create failed (${res.status})`);
      setItem(""); setQuantity(""); setProject(""); setNotes(""); await fetchRequests();
    } catch (e) { setError(e.message || "Failed to create request"); }
    finally { setLoading(false); }
  };

  const startEdit = (r) => { setEditingId(r.id); setEditForm({ item:r.item||"", quantity:String(r.quantity??""), project:r.project||"", notes:r.notes||"" }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({ item:"", quantity:"", project:"", notes:"" }); };
  const saveEdit = async (id) => {
    setError(""); setLoading(true);
    try {
      const payload = {};
      if (editForm.item !== "") payload.item = editForm.item;
      if (editForm.quantity !== "") payload.quantity = Number(editForm.quantity);
      if (editForm.project !== "") payload.project = editForm.project;
      payload.notes = editForm.notes;
      const res = await fetch(`${API_URL}/requests/${id}`, {
        method:"PATCH", headers:{ ...authHeaders, "Content-Type":"application/json" }, body: JSON.stringify(payload)
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Edit failed (${res.status})`);
      setEditingId(null); await fetchRequests();
    } catch (e) { setError(e.message || "Failed to edit request"); }
    finally { setLoading(false); }
  };

  const uploadPhoto = async (id, file) => {
    if (!file) return; setError(""); setLoading(true);
    try {
      const fd = new FormData(); fd.append("photo", file);
      const res = await fetch(`${API_URL}/requests/${id}/photo`, { method:"POST", headers:{ ...authHeaders }, body: fd });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
      await fetchRequests();
    } catch (e) { setError(e.message || "Failed to upload photo"); }
    finally { setLoading(false); }
  };

  /** -------- Supervisor actions -------- */
  const updateStatus = async (id, status) => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests/${id}/status`, {
        method:"PATCH", headers:{ ...authHeaders, "Content-Type":"application/json" }, body: JSON.stringify({ status })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`);
      await fetchRequests();
    } catch (e) { setError(e.message || "Failed to update status"); }
    finally { setLoading(false); }
  };
  const escalateToOwner = async (id) => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests/${id}/escalate`, { method:"PATCH", headers:{ ...authHeaders } });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Escalate failed (${res.status})`);
      await fetchRequests();
    } catch (e) { setError(e.message || "Failed to escalate"); }
    finally { setLoading(false); }
  };

  /** -------- Owner actions -------- */
  const ownerDecision = async (id, decision) => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/requests/${id}/owner`, {
        method:"PATCH", headers:{ ...authHeaders, "Content-Type":"application/json" }, body: JSON.stringify({ decision })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Owner action failed (${res.status})`);
      await Promise.all([fetchOwnerInbox(), fetchRequests()]);
    } catch (e) { setError(e.message || "Failed to record owner decision"); }
    finally { setLoading(false); }
  };

  /** -------- Admin: complexes & invites -------- */
  const createComplex = async () => {
    const name = (newComplexName || "").trim();
    if (!name) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/complexes`, {
        method:"POST", headers:{ ...authHeaders, "Content-Type":"application/json" }, body: JSON.stringify({ name })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Create complex failed (${res.status})`);
      setNewComplexName(""); await fetchComplexes();
    } catch (e) { setError(e.message || "Failed to create complex"); }
    finally { setLoading(false); }
  };

  const ownerInviteUser = async () => {
    const u = (ownerInvite.username || "").trim();
    if (!u) return; if (!ownerInvite.role) return;
    if (!ownerInvite.complex_id) { setError("Pick a complex"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/invites`, {
        method:"POST", headers:{ ...authHeaders, "Content-Type":"application/json" },
        body: JSON.stringify({
          username: u,
          role: ownerInvite.role,                // "manager" or "worker"
          complex_id: Number(ownerInvite.complex_id)
        })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Invite failed (${res.status})`);
      setOwnerInvite({ username:"", role:"manager", complex_id: complexes[0] ? String(complexes[0].id) : "" });
      const link = buildInviteLink(data.invite_token);
      setLastInviteLink(link); await fetchUsers();
    } catch (e) { setError(e.message || "Failed to create invite"); }
    finally { setLoading(false); }
  };

  const supervisorInviteEmployee = async () => {
    const u = (superInvite.username || "").trim(); if (!u) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/invites`, {
        method:"POST", headers:{ ...authHeaders, "Content-Type":"application/json" },
        body: JSON.stringify({ username: u })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Invite failed (${res.status})`);
      setSuperInvite({ username:"" });
      const link = buildInviteLink(data.invite_token);
      setLastInviteLink(link); await fetchUsers();
    } catch (e) { setError(e.message || "Failed to create invite"); }
    finally { setLoading(false); }
  };

  /** -------- Admin: manage accounts -------- */
  const resetPasswordFor = async (u) => {
    const npw = window.prompt(`Enter a new password for ${u.username}:`);
    if (!npw) return; setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/${u.id}/password`, {
        method:"PATCH", headers:{ ...authHeaders, "Content-Type":"application/json" },
        body: JSON.stringify({ new_password: npw })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Reset failed (${res.status})`);
      await fetchUsers();
    } catch (e) { setError(e.message || "Failed to reset password"); }
    finally { setLoading(false); }
  };

  const toggleActiveFor = async (u) => {
    setError(""); setLoading(true);
    try {
      const ep = u.active ? "disable" : "enable";
      const res = await fetch(`${API_URL}/users/${u.id}/${ep}`, { method:"PATCH", headers:{ ...authHeaders } });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`);
      await fetchUsers();
    } catch (e) { setError(e.message || "Failed to update account status"); }
    finally { setLoading(false); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.username}? This cannot be undone.`)) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/${u.id}`, { method:"DELETE", headers:{ ...authHeaders } });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Delete failed (${res.status})`);
      await fetchUsers();
    } catch (e) { setError(e.message || "Failed to delete user"); }
    finally { setLoading(false); }
  };

  /** ---------- Views ---------- */
  if (!token) {
    return (
      <ErrorBoundary>
        <div style={wrap}>
          <Card>
            <h2>Login</h2>
            <form onSubmit={login} style={{ display:"grid", gap:8 }}>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <label style={roleChip(loginRole==="owner")} onClick={()=>setLoginRole("owner")}>Owner</label>
                <label style={roleChip(loginRole==="manager")} onClick={()=>setLoginRole("manager")}>Supervisor</label>
                <label style={roleChip(loginRole==="worker")} onClick={()=>setLoginRole("worker")}>Employee</label>
              </div>
              <input style={input} placeholder="Username" value={username} onChange={(e)=>setUsername(e.target.value)} />
              <input style={input} type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} />
              <button style={btn} disabled={loading}>
                {loading ? "Signing in..." : `Login as ${toLabel(loginRole)}`}
              </button>
            </form>
            {error && <div style={errBanner}>{error}</div>}
          </Card>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div style={wrap}>
        <header style={header}>
          <h2>Construction Supply App</h2>
          <div>
            <span style={{ marginRight:12 }}>Role: <b>{toLabel(role)}</b></span>
            <button style={btnSmall} onClick={logout}>Logout</button>
          </div>
        </header>

        {error && <div style={errBanner}>{error}</div>}

        {/* OWNER */}
        {role === "owner" && (
          <>
            <Card>
              <div style={rowBetween}>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button style={tab(ownerTab==="inbox")} onClick={()=>{ setOwnerTab("inbox"); fetchOwnerInbox(); }}>Inbox</button>
                  <button style={tab(ownerTab==="all")} onClick={()=>{ setOwnerTab("all"); fetchRequests(); }}>All Requests</button>
                  <button style={tab(ownerTab==="admin")} onClick={()=>{ setOwnerTab("admin"); fetchComplexes(); fetchUsers(); }}>Admin</button>
                </div>
                <button
                  style={btnSmall}
                  onClick={()=>{ if (ownerTab==="inbox") fetchOwnerInbox(); if (ownerTab==="all") fetchRequests(); if (ownerTab==="admin") { fetchComplexes(); fetchUsers(); } }}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
              </div>
            </Card>

            {ownerTab === "inbox" && (
              <Card>
                <h3>Owner Approval Inbox (Escalated)</h3>
                {(!Array.isArray(ownerInbox) || ownerInbox.length===0) && <div style={{ color:"#666" }}>No escalated requests.</div>}
                {Array.isArray(ownerInbox) && ownerInbox.map((r)=>(
                  <RequestRow key={r.id} r={r} role="owner" onOwnerDecision={ownerDecision} />
                ))}
              </Card>
            )}

            {ownerTab === "all" && (
              <RequestList title="All Requests" role="owner" requests={requests} onRefresh={fetchRequests} />
            )}

            {ownerTab === "admin" && (
              <Card>
                <h3>Owner Admin</h3>

                <section style={{ marginBottom:16 }}>
                  <h4>Create Complex</h4>
                  <div style={{ display:"grid", gridTemplateColumns:"2fr auto", gap:8 }}>
                    <input style={input} placeholder="Complex name" value={newComplexName} onChange={e=>setNewComplexName(e.target.value)} />
                    <button style={btnSmall} onClick={createComplex}>Add Complex</button>
                  </div>
                </section>

                <section style={{ marginBottom:16 }}>
                  <h4>Invite Supervisor / Employee</h4>
                  <div style={gridAdmin}>
                    <input style={input} placeholder="Username" value={ownerInvite.username} onChange={e=>setOwnerInvite(v=>({ ...v, username:e.target.value }))} />
                    <select style={input} value={ownerInvite.role} onChange={e=>setOwnerInvite(v=>({ ...v, role:e.target.value }))}>
                      <option value="manager">Supervisor</option>
                      <option value="worker">Employee</option>
                    </select>
                    <select
                      style={input}
                      value={ownerInvite.complex_id}
                      onChange={e=>setOwnerInvite(v=>({ ...v, complex_id:e.target.value }))}
                      disabled={!Array.isArray(complexes) || complexes.length===0}
                    >
                      {Array.isArray(complexes) && complexes.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                    <button style={btnSmall} onClick={ownerInviteUser} disabled={!Array.isArray(complexes) || complexes.length===0}>Create Invite</button>
                  </div>
                  {lastInviteLink && (
                    <div style={{ marginTop:8 }}>
                      <b>Invite link:</b> <span style={{ wordBreak:"break-all" }}>{lastInviteLink}</span>
                      <button style={{ ...btnTiny, marginLeft:8 }} onClick={()=>copy(lastInviteLink)}>Copy</button>
                    </div>
                  )}
                </section>

                <section>
                  <h4>All Users</h4>
                  <UserTable
                    users={users}
                    canManage={(u)=>u && u.role !== "owner"}
                    onReset={resetPasswordFor}
                    onToggle={toggleActiveFor}
                    onDelete={deleteUser}
                  />
                </section>
              </Card>
            )}
          </>
        )}

        {/* SUPERVISOR */}
        {role === "manager" && (
          <>
            <Card>
              <h3>Supervisor Admin — Invite Employee</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8, marginBottom:6 }}>
                <input style={input} placeholder="Employee username" value={superInvite.username} onChange={e=>setSuperInvite({ username:e.target.value })} />
                <button style={btnSmall} onClick={supervisorInviteEmployee}>Create Invite</button>
              </div>
              {lastInviteLink && (
                <div style={{ marginBottom:8 }}>
                  <b>Invite link:</b> <span style={{ wordBreak:"break-all" }}>{lastInviteLink}</span>
                  <button style={{ ...btnTiny, marginLeft:8 }} onClick={()=>copy(lastInviteLink)}>Copy</button>
                </div>
              )}
              <button style={btnSmall} onClick={()=>{ fetchUsers(); fetchRequests(); }} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh Lists"}
              </button>

              <div style={{ marginTop:12 }}>
                <h4>People in Your Complex</h4>
                <UserTable
                  users={users}
                  canManage={(u)=>u && u.role === "worker"}
                  onReset={resetPasswordFor}
                  onToggle={toggleActiveFor}
                  onDelete={deleteUser}
                />
              </div>
            </Card>

            <RequestList
              title="Complex Requests"
              role="manager"
              requests={requests}
              onRefresh={fetchRequests}
              onUpdateStatus={updateStatus}
              onEscalate={escalateToOwner}
            />
          </>
        )}

        {/* EMPLOYEE */}
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
              onStartEdit={(r)=>{ setEditingId(r.id); setEditForm({ item:r.item||"", quantity:String(r.quantity??""), project:r.project||"", notes:r.notes||"" }); }}
              onCancelEdit={()=>{ setEditingId(null); setEditForm({ item:"", quantity:"", project:"", notes:"" }); }}
              onSaveEdit={saveEdit}
              editingId={editingId}
              editForm={editForm}
              setEditForm={setEditForm}
              onUploadPhoto={uploadPhoto}
            />
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}

/** =========================
 *  Accept Invite
 *  ========================= */
function AcceptInvite({ token }) {
  const [valid, setValid] = useState(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/invites/${encodeURIComponent(token)}/validate`);
        const data = await res.json().catch(()=> ({}));
        if (!res.ok) throw new Error(data?.error || "Invalid invite");
        setUsername(data?.user?.username || ""); setRole(data?.user?.role || "");
        setValid(true);
      } catch (e) { setErr(e.message || "Invite invalid or expired"); setValid(false); }
    })();
  }, [token]);

  const submit = async () => {
    setErr(""); setMsg("");
    if (!pw || pw !== pw2) { setErr("Passwords must match."); return; }
    try {
      const res = await fetch(`${API_URL}/accept-invite`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ token, password: pw })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      setMsg("Password set! You can now log in.");
    } catch (e) { setErr(e.message || "Failed to set password"); }
  };

  if (valid === null) return <div style={wrap}><Card><p>Checking invite…</p></Card></div>;
  if (valid === false) return <div style={wrap}><Card><h3>Invite Error</h3><div style={errBanner}>{err}</div></Card></div>;

  return (
    <div style={wrap}>
      <Card>
        <h2>Set Your Password</h2>
        <p>Username: <b>{username}</b> • Role: <b>{ROLE_LABEL[role] || role}</b></p>
        <div style={{ display:"grid", gap:8, maxWidth:420 }}>
          <input style={input} type="password" placeholder="New password" value={pw} onChange={(e)=>setPw(e.target.value)} />
          <input style={input} type="password" placeholder="Confirm password" value={pw2} onChange={(e)=>setPw2(e.target.value)} />
          <button style={btn} onClick={submit}>Save Password</button>
        </div>
        {msg && <div style={{ marginTop:8 }}>{msg}</div>}
        {err && <div style={{ ...errBanner, marginTop:8 }}>{err}</div>}
      </Card>
    </div>
  );
}

/** =========================
 *  Reusable Components
 *  ========================= */
function RequestList({ title, role, requests, onRefresh, onUpdateStatus, onEscalate,
  onStartEdit, onCancelEdit, onSaveEdit, editingId, editForm, setEditForm, onUploadPhoto }) {

  const list = Array.isArray(requests) ? requests : [];
  return (
    <Card>
      <div style={rowBetween}>
        <h3>{title}</h3>
        <button style={btnSmall} onClick={()=>onRefresh()}>Refresh</button>
      </div>

      {list.length === 0 && <div style={{ color:"#666" }}>No requests yet.</div>}

      {list.map((r) => {
        const pending = r.status === "pending";
        return (
          <div key={r.id} style={reqRow}>
            <div style={{ flex:1 }}>
              <div><b>{r.item}</b> • Qty {r.quantity} • Project {r.project}</div>
              <div style={{ marginTop:4 }}>
                <StatusBadge status={r.status} />
                <OwnerBadge ownerStatus={r.owner_status} />
                {r.photo_url && (
                  <a href={`${API_URL}${r.photo_url}`} target="_blank" rel="noreferrer" style={{ marginLeft:10 }}>
                    {ICON.photo} View Photo
                  </a>
                )}
              </div>
              {r.notes && <div style={{ color:"#555", marginTop:4 }}>Notes: {r.notes}</div>}
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
                    <button
                      style={btnTinyDanger}
                      onClick={()=> window.confirm("Cancel this request?") && onUpdateStatus(r.id,"canceled")}
                    >
                      {ICON.cancel} Cancel
                    </button>
                    <label style={{ ...btnTiny, display:"inline-block", cursor:"pointer" }}>
                      {ICON.photo} Upload
                      <input type="file" accept="image/*" style={{ display:"none" }}
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
        <div style={{ marginTop:10, paddingTop:10, borderTop:"1px dashed #e5e7eb" }}>
          <h4>Edit Request</h4>
          <div style={grid}>
            <input style={input} placeholder="Item" value={editForm.item} onChange={(e)=>setEditForm(f=>({ ...f, item:e.target.value }))} />
            <input style={input} type="number" placeholder="Quantity" value={editForm.quantity} onChange={(e)=>setEditForm(f=>({ ...f, quantity:e.target.value }))} />
            <input style={input} placeholder="Project" value={editForm.project} onChange={(e)=>setEditForm(f=>({ ...f, project:e.target.value }))} />
            <input style={input} placeholder="Notes" value={editForm.notes} onChange={(e)=>setEditForm(f=>({ ...f, notes:e.target.value }))} />
          </div>
        </div>
      )}
    </Card>
  );
}

function RequestRow({ r, role, onOwnerDecision }) {
  return (
    <div style={reqRow}>
      <div style={{ flex:1 }}>
        <div><b>{r.item}</b> • Qty {r.quantity} • Project {r.project}</div>
        <div style={{ marginTop:4 }}>
          <StatusBadge status={r.status} />
          <OwnerBadge ownerStatus={r.owner_status} />
          {r.photo_url && (
            <a href={`${API_URL}${r.photo_url}`} target="_blank" rel="noreferrer" style={{ marginLeft:10 }}>
              {ICON.photo} View Photo
            </a>
          )}
        </div>
        {r.notes && <div style={{ color:"#555", marginTop:4 }}>Notes: {r.notes}</div>}
      </div>
      {role === "owner" && (
        <div style={btnGroup}>
          <button style={btnTiny} onClick={()=>onOwnerDecision(r.id,"approved")}>{ICON.approve} Approve</button>
          <button style={btnTinyDanger} onClick={()=>onOwnerDecision(r.id,"rejected")}>{ICON.reject} Reject</button>
        </div>
      )}
    </div>
  );
}

function UserTable({ users, canManage, onReset, onToggle, onDelete }) {
  const safeUsers = Array.isArray(users) ? users : [];
  const may = (u) => { try { return !!canManage(u); } catch { return false; } };
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>Username</th>
            <th style={th}>Role</th>
            <th style={th}>Complex</th>
            <th style={th}>Active</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {safeUsers.map(u=>(
            <tr key={u.id}>
              <td style={td}>{u.id}</td>
              <td style={td}>{u.username}</td>
              <td style={td}>{ROLE_LABEL[u.role] || u.role}</td>
              <td style={td}>{u.complex_id ?? "—"}</td>
              <td style={td}>{u.active ? "Yes" : "No"}</td>
              <td style={{ ...td, whiteSpace:"nowrap" }}>
                {may(u) ? (
                  <>
                    <button style={btnTiny} onClick={()=>onReset(u)}>Reset PW</button>
                    <button style={btnTiny} onClick={()=>onToggle(u)}>{u.active ? "Disable" : "Enable"}</button>
                    <button style={btnTinyDanger} onClick={()=>onDelete(u)}>Delete</button>
                  </>
                ) : <span style={{ color:"#6b7280" }}>—</span>}
              </td>
            </tr>
          ))}
          {safeUsers.length === 0 && <tr><td style={td} colSpan="6">No users yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** =========================
 *  Badges & Styles
 *  ========================= */
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
  return <span style={{ background:c.bg, color:c.fg, padding:"2px 8px", borderRadius:999, fontSize:12 }}>{c.label}</span>;
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
  return <span style={{ background:c.bg, color:c.fg, padding:"2px 8px", borderRadius:999, fontSize:12, marginLeft:8 }}>{c.label}</span>;
}

/** =========================
 *  Utils & Styles
 *  ========================= */
function buildInviteLink(inviteToken) {
  return `${window.location.origin}/#accept-invite=${encodeURIComponent(inviteToken)}`;
}
function readInviteFromHash() {
  try {
    const h = window.location.hash || "";
    const m = h.match(/^#accept-invite=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch { return ""; }
}
function copy(text) {
  try { navigator.clipboard?.writeText(text); } catch {}
  alert("Invite link copied!");
}

/* styles */
const wrap = { maxWidth:1220, margin:"20px auto", padding:"0 16px", fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header = { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 };
const Card = ({ children }) => <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:16, margin:"12px auto", maxWidth:1220, boxShadow:"0 1px 2px rgba(0,0,0,0.05)" }}>{children}</div>;
const grid = { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, alignItems:"center" };
const gridAdmin = { display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:8, alignItems:"center" };
const input = { padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:8, width:"100%" };
const btn = { padding:"10px 14px", border:"none", background:"#0d6efd", color:"#fff", borderRadius:8, cursor:"pointer" };
const btnSmall = { ...btn, padding:"6px 10px", borderRadius:6 };
const btnTiny = { ...btnSmall, fontSize:12, padding:"6px 8px" };
const btnTinyDanger = { ...btnTiny, background:"#dc2626" };
const btnGroup = { display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" };
const rowBetween = { display:"flex", alignItems:"center", justifyContent:"space-between" };
const reqRow = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f1f5f9", gap:10 };
const errBanner = { margin:"8px 0", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA", padding:"8px 10px", borderRadius:8 };
const roleChip = (active) => ({ padding:"6px 10px", borderRadius:999, border:active?"2px solid #0d6efd":"1px solid #cbd5e1", background:active?"#eff6ff":"#fff", cursor:"pointer", userSelect:"none" });
const tab = (active) => ({ ...btnSmall, background: active ? "#0d6efd" : "#e5e7eb", color: active ? "#fff" : "#111827" });
