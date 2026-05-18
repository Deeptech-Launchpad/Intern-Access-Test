import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, ShieldCheck, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout';
import API from '../../api';
import './ManageAdmins.css';

export default function ManageAdmins() {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('');
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [creating, setCreating] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const getLoggedInUsername = () => {
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) return null;
            return JSON.parse(atob(token.split('.')[1])).sub;
        } catch { return null; }
    };
    const loggedInUsername = getLoggedInUsername();

    const fetchAdmins = async () => {
        try {
            const res = await API.get('/admin/admins');
            setAdmins(res.data);
        } catch { toast.error('Failed to load admins'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAdmins(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) { toast.error('Username and password are required'); return; }
        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            toast.error('Please enter a valid email address'); return;
        }
        setCreating(true);
        try {
            const res = await API.post('/admin/create-admin', {
                username: username.trim(),
                password,
                email: email.trim() || null,
            });
            toast.success(`Admin "${res.data.username}" created!`);
            setUsername(''); setPassword(''); setEmail('');
            fetchAdmins();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create admin');
        } finally { setCreating(false); }
    };

    const handleToggle = async (admin) => {
        setTogglingId(admin.id);
        try {
            const res = await API.patch(`/admin/admins/${admin.id}/toggle-active`);
            const state = res.data.is_active ? 'Activated' : 'Deactivated';
            toast.success(`${state} "${admin.username}"`);
            setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, is_active: res.data.is_active } : a));
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to toggle');
        } finally { setTogglingId(null); }
    };

    const handleDelete = async (admin) => {
        if (!window.confirm(`Delete admin "${admin.username}"? This cannot be undone.`)) return;
        setDeletingId(admin.id);
        try {
            await API.delete(`/admin/admins/${admin.id}`);
            toast.success(`Deleted "${admin.username}"`);
            setAdmins(prev => prev.filter(a => a.id !== admin.id));
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to delete admin');
        } finally { setDeletingId(null); }
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <h1>Manage Admins</h1>
                <p>Create admin accounts or toggle their access</p>
            </div>

            {/* Create Admin Form */}
            <div className="card ma-card">
                <div className="ma-form-title">
                    <UserPlus size={20} color="var(--primary)" />
                    <strong>Create New Admin</strong>
                </div>
                <form className="ma-form" onSubmit={handleCreate}>
                    <div className="ma-field">
                        <label>Username</label>
                        <input type="text" placeholder="e.g. team_lead_raj"
                            value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
                    </div>
                    <div className="ma-field">
                        <label>Email <span className="ma-hint">(for assessment completion notifications)</span></label>
                        <input type="email" placeholder="e.g. admin@company.com"
                            value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" />
                    </div>
                    <div className="ma-field">
                        <label>Password <span className="ma-hint">(min 6 characters)</span></label>
                        <div className="ma-pw-wrap">
                            <input type={showPw ? 'text' : 'password'} placeholder="Enter a strong password"
                                value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                            <button type="button" className="ma-pw-toggle" onClick={() => setShowPw(!showPw)}>
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button className="btn btn-primary ma-btn" type="submit" disabled={creating}>
                        {creating ? 'Creating…' : 'Create Admin'}
                    </button>
                </form>
            </div>

            {/* Existing Admins List */}
            <div className="card ma-card" style={{ marginTop: 24 }}>
                <div className="ma-form-title">
                    <ShieldCheck size={20} color="var(--primary)" />
                    <strong>Existing Admins ({admins.length})</strong>
                </div>

                {loading ? (
                    <p className="ma-loading">Loading…</p>
                ) : admins.length === 0 ? (
                    <p className="ma-loading">No admins found.</p>
                ) : (
                    <ul className="ma-admin-list">
                        {admins.map(admin => {
                            const isSelf = admin.username === loggedInUsername;
                            const isActive = admin.is_active !== false; // default true
                            return (
                                <li key={admin.id} className={`ma-admin-row ${!isActive ? 'ma-inactive-row' : ''}`}>
                                    <div className="ma-admin-info">
                                        <ShieldCheck size={16} color={isSelf ? 'var(--primary)' : isActive ? '#6b7280' : '#d1d5db'} />
                                        <div>
                                            <span className="ma-admin-name" style={{ color: !isActive ? 'var(--text-muted)' : undefined }}>
                                                {admin.username}
                                                {isSelf && <span className="ma-you-badge">You</span>}
                                                {!isActive && <span className="ma-inactive-badge">Inactive</span>}
                                            </span>
                                            {admin.email && (
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                                                    {admin.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="ma-admin-actions">
                                        {/* Active / Inactive toggle */}
                                        {!isSelf && (
                                            <button
                                                className={`ma-toggle-btn ${isActive ? 'active' : 'inactive'}`}
                                                onClick={() => handleToggle(admin)}
                                                disabled={togglingId === admin.id}
                                                title={isActive ? 'Click to Deactivate' : 'Click to Activate'}
                                            >
                                                {togglingId === admin.id ? '…' : isActive
                                                    ? <><ToggleRight size={16} /> Active</>
                                                    : <><ToggleLeft size={16} /> Inactive</>
                                                }
                                            </button>
                                        )}
                                        {/* Delete */}
                                        <button
                                            className="ma-delete-btn"
                                            onClick={() => handleDelete(admin)}
                                            disabled={isSelf || deletingId === admin.id}
                                            title={isSelf ? "Can't delete your own account" : `Delete ${admin.username}`}
                                        >
                                            <Trash2 size={15} />
                                            {deletingId === admin.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </AdminLayout>
    );
}
