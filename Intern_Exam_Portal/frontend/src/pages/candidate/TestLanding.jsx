import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, Shield, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';
import './TestLanding.css';

// Device lock
function DeviceBlock() {
    return (
        <div className="device-block">
            <Monitor size={64} strokeWidth={1.5} />
            <h2>Desktop / Laptop Required</h2>
            <p>This assessment can only be taken on a desktop or laptop browser (screen width ≥ 1024px).</p>
            <p style={{ marginTop: 8, opacity: 0.6, fontSize: 14 }}>Please switch to a larger device to continue.</p>
        </div>
    );
}

export default function TestLanding() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleStart = async (e) => {
        e.preventDefault();
        if (!email) { toast.error('Please enter your email address'); return; }
        setLoading(true);
        try {
            const res = await API.post('/candidate/verify', { token, email });
            // Store session data for TestPage
            sessionStorage.setItem('session_id', res.data.session_id);
            sessionStorage.setItem('candidate_name', res.data.name);
            sessionStorage.setItem('questions', JSON.stringify(res.data.questions));
            sessionStorage.setItem('question_order', JSON.stringify(res.data.question_order));
            sessionStorage.setItem('test_token', token);
            navigate(`/exam/${token}`);
        } catch (err) {
            const msg = err.response?.data?.detail || 'Verification failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <DeviceBlock />
            <div className="landing-wrapper">
                <div className="landing-left">
                    <div className="landing-brand">
                        <div className="brand-dot">IA</div>
                        <span>InternAssess</span>
                    </div>
                    <h1>Welcome to the<br />Internship Assessment</h1>
                    <p>You have been invited to complete a timed MCQ assessment. The test consists of <strong>25 questions</strong> and must be completed in a single session.</p>

                    <div className="rules-box">
                        <h3>Before you begin:</h3>
                        <ul>
                            <li>✦ Do not switch tabs or minimize the browser</li>
                            <li>✦ Switching tabs 3 times will auto-submit your test</li>
                            <li>✦ Questions are shuffled — each candidate sees a unique order</li>
                            <li>✦ You can navigate between questions freely</li>
                            <li>✦ Ensure a stable internet connection</li>
                        </ul>
                    </div>
                </div>

                <div className="landing-right">
                    <div className="verify-card card">
                        <div className="verify-icon">
                            <Shield size={28} color="var(--primary)" />
                        </div>
                        <h2>Identity Verification</h2>
                        <p>Enter the email address associated with your test invitation to begin.</p>

                        <form onSubmit={handleStart} style={{ marginTop: 24 }}>
                            <div className="form-group">
                                <label><Mail size={12} style={{ marginRight: 4 }} />Your Email Address</label>
                                <input
                                    type="email"
                                    placeholder="Enter your registered email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                                {loading ? 'Verifying...' : 'Verify & Start Test →'}
                            </button>
                        </form>

                        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-muted)' }}>
                            By starting, you agree to complete the test without external assistance.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
