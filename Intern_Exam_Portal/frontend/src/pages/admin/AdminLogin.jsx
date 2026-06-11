import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api';
import './AdminLogin.css';

// ──────────────────────────────────────────────────────────
// │  CONFIG — single source of truth for this app's login  │
// ──────────────────────────────────────────────────────────
const CONFIG = {
    appName:  'Intern Assessment',
    appShort: 'IA',
    appColor: '#1d4ed8',

    features: [
        'AI-powered grading & ranking',
        'Proctored test environment',
        'Bulk MCQ upload via Excel',
    ],

    suite:    ['HR', 'LMS', 'Billing', 'Helpdesk', 'Assessment', 'Reports'],
    suiteKey: 'Assessment',
    suiteLinks: {
        'HR':         'https://nxtpeople.altiusnxt.tech',
        'LMS':        'https://lms.altiusnxt.tech/login',
        'Billing':    'https://nxtbilling.altiusnxt.tech/login',
        'Helpdesk':   'https://tickets.altiusnxt.tech/login',
        'Assessment': 'https://assess.altiusnxt.tech',
        'Reports':    'https://ur.altiusnxt.tech',
    },

    redirectAfterLogin: '/admin',
    supportEmail:       'it@altiusnxt.com',
    logoPath:           '/AltiusNXT_Logo-01.png',
};

const CHECK_ICON = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleForgot = () => {
        window.alert('Contact IT support: ' + CONFIG.supportEmail);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!username || !password) {
            setError('Please fill in all fields.');
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);
            const res = await API.post('/admin/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            localStorage.setItem('admin_token', res.data.access_token);
            navigate(CONFIG.redirectAfterLogin);
        } catch (err) {
            const msg = err.response?.data?.detail || 'Invalid credentials. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="anx-login-page">
            {/* ── LEFT PANEL ──────────────────────────────────────────── */}
            <div className="anx-left">
                <div className="anx-geo" aria-hidden="true">
                    <div className="anx-geo-1" />
                    <div className="anx-geo-2" />
                    <div className="anx-geo-3" />
                </div>

                <div className="anx-logo-wrap">
                    <img src={CONFIG.logoPath} alt="AltiusNxt Technologies" />
                </div>

                <div className="anx-left-body">
                    <div className="anx-left-divider" />
                    <p className="anx-access-label">Secure Workspace Access</p>
                    <h2 className="anx-app-name">{CONFIG.appName}</h2>
                    <div className="anx-red-rule" />
                    <ul className="anx-feature-list">
                        {CONFIG.features.map((f) => (
                            <li key={f} className="anx-feature-item">
                                <span className="anx-feat-icon">{CHECK_ICON}</span>
                                <span>{f}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="anx-left-bottom">
                    <div className="anx-bottom-divider" />
                    <p className="anx-suite-label">Part of AltiusNxt Suite</p>
                    <div className="anx-suite-chips">
                        {CONFIG.suite.map((s) => {
                            if (s === CONFIG.suiteKey) {
                                return <span key={s} className="anx-suite-chip active">{s}</span>;
                            }
                            const url = CONFIG.suiteLinks[s];
                            return url
                                ? <a key={s} className="anx-suite-chip" href={url}>{s}</a>
                                : <span key={s} className="anx-suite-chip">{s}</span>;
                        })}
                    </div>
                    <p className="anx-left-foot">© 2026 AltiusNxt Technologies Pvt. Ltd.</p>
                </div>
            </div>

            {/* ── RIGHT PANEL ─────────────────────────────────────────── */}
            <div className="anx-right">
                <div className="anx-right-content">
                    <div className="anx-card">
                        <div className="anx-app-badge" style={{ background: CONFIG.appColor }}>
                            <span className="anx-app-badge-short">{CONFIG.appShort}</span>
                        </div>
                        <h1 className="anx-right-title">Sign In</h1>
                        <p className="anx-right-sub">Access {CONFIG.appName}</p>

                        <form className="anx-form" onSubmit={handleSubmit} noValidate>
                            <div className="anx-field">
                                <label htmlFor="anx-username">Username</label>
                                <input
                                    id="anx-username"
                                    type="text"
                                    placeholder="you@altiusnxt.com"
                                    autoComplete="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="anx-field">
                                <div className="anx-label-row">
                                    <label htmlFor="anx-password">Password</label>
                                    <button type="button" className="anx-forgot-btn" onClick={handleForgot}>
                                        Forgot password?
                                    </button>
                                </div>
                                <input
                                    id="anx-password"
                                    type="password"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            {error && <p className="anx-msg-error">{error}</p>}

                            <button type="submit" className="anx-submit-btn" disabled={loading}>
                                {loading ? <span className="anx-spinner" /> : 'Sign In'}
                            </button>
                        </form>

                        <div className="anx-right-foot">
                            Need help?{' '}
                            <a href={'mailto:' + CONFIG.supportEmail}>Contact IT Support</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
