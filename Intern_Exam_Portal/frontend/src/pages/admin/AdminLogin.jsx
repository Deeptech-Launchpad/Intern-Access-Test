import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';
import './AdminLogin.css';

export default function AdminLogin() {
    const [form, setForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.password) {
            toast.error('Please enter username and password');
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('username', form.username);
            params.append('password', form.password);
            const res = await API.post('/admin/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            localStorage.setItem('admin_token', res.data.access_token);
            toast.success('Welcome back, Admin!');
            navigate('/admin');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrapper">
            {/* Left panel */}
            <div className="login-hero">
                <div className="hero-content">
                    <div className="hero-logo">IA</div>
                    <h1>InternAssess</h1>
                    <p>A professional assessment platform for internship candidates. Secure. Fast. Insightful.</p>
                    <div className="hero-features">
                        <div className="feature-item">✦ AI-powered grading & ranking</div>
                        <div className="feature-item">✦ Proctored test environment</div>
                        <div className="feature-item">✦ Bulk MCQ upload via Excel</div>
                        <div className="feature-item">✦ Encrypted candidate links</div>
                    </div>
                </div>
            </div>

            {/* Right panel */}
            <div className="login-panel">
                <div className="login-card">
                    <h2>Admin Sign In</h2>
                    <p className="login-sub">Access the management dashboard</p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Username</label>
                            <div className="input-icon-wrap">
                                <User size={16} className="input-icon" />
                                <input
                                    type="text"
                                    placeholder="Enter username"
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <div className="input-icon-wrap">
                                <Lock size={16} className="input-icon" />
                                <input
                                    type="password"
                                    placeholder="Enter password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
