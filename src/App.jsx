import React, { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [token, setToken] = useState('')
  const [role, setRole] = useState('')
  const [form, setForm] = useState({ project:'', item:'', quantity:'', notes:'', photo:null })
  const [requests, setRequests] = useState([])
  const [loginForm, setLoginForm] = useState({ username:'', password:'' })

  const login = async (e) => {
    e.preventDefault()
    const res = await axios.post(`${API_URL}/login`, loginForm)
    setToken(res.data.token)
    setRole(res.data.role)
  }

  const submitRequest = async (e) => {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    await axios.post(`${API_URL}/requests`, fd, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
    })
    alert('Submitted')
  }

  const fetchRequests = async () => {
    const res = await axios.get(`${API_URL}/requests`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setRequests(res.data)
  }

  useEffect(() => { if (role === 'manager') fetchRequests() }, [role])

  return (
    <div style={{ maxWidth: 900, margin: '20px auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h2>Construction Supply App</h2>
      {!token && (
        <form onSubmit={login} style={{ marginBottom: 20 }}>
          <h3>Login</h3>
          <input placeholder="Username" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username:e.target.value})} /><br/>
          <input placeholder="Password" type="password" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password:e.target.value})} /><br/>
          <button type="submit">Login</button>
        </form>
      )}

      {token && role === 'worker' && (
        <form onSubmit={submitRequest}>
          <h3>Submit Request</h3>
          <input placeholder="Project" onChange={e=>setForm({...form, project:e.target.value})} /><br/>
          <input placeholder="Item" onChange={e=>setForm({...form, item:e.target.value})} /><br/>
          <input placeholder="Quantity" type="number" onChange={e=>setForm({...form, quantity:e.target.value})} /><br/>
          <textarea placeholder="Notes" onChange={e=>setForm({...form, notes:e.target.value})} /><br/>
          <input type="file" onChange={e=>setForm({...form, photo:e.target.files[0]})} /><br/>
          <button type="submit">Submit</button>
        </form>
      )}

      {token && role === 'manager' && (
        <div>
          <h3>Manager Dashboard</h3>
          <button onClick={fetchRequests}>Refresh</button>
          <ul>
            {requests.map(r => (
              <li key={r.id}>
                <b>{r.item}</b> — {r.status} — Qty {r.quantity} — Project {r.project}
                {r.photo_url && <> — <a href={`${API_URL}${r.photo_url}`} target="_blank">Photo</a></>}
                <div>
                  <button onClick={()=>axios.put(`${API_URL}/requests/${r.id}`, {status:'approved'}, {headers:{Authorization:`Bearer ${token}`}}).then(fetchRequests)}>Approve</button>
                  <button onClick={()=>axios.put(`${API_URL}/requests/${r.id}`, {status:'ordered'}, {headers:{Authorization:`Bearer ${token}`}}).then(fetchRequests)}>Mark Ordered</button>
                  <button onClick={()=>axios.put(`${API_URL}/requests/${r.id}`, {status:'delivered'}, {headers:{Authorization:`Bearer ${token}`}}).then(fetchRequests)}>Mark Delivered</button>
                  <button onClick={()=>axios.put(`${API_URL}/requests/${r.id}`, {status:'rejected'}, {headers:{Authorization:`Bearer ${token}`}}).then(fetchRequests)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
