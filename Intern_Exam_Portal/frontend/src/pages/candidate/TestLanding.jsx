import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, Shield, Monitor, Camera, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';
import './TestLanding.css';

function DeviceBlock() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handler = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    if (width >= 1024) return null;
    return (
        <div className="device-block">
            <div className="device-block-icon"><Monitor size={56} strokeWidth={1.5} /></div>
            <h2>Desktop / Laptop Required</h2>
            <p>This assessment requires a screen of at least <strong>1024px</strong> wide.</p>
            <div className="device-width-indicator">
                <div className="device-width-bar">
                    <div className="device-width-fill" style={{ width: `${Math.min(100, (width / 1024) * 100)}%` }} />
                </div>
                <p className="device-width-label">Your screen: <strong>{width}px</strong> / Required: <strong>1024px</strong></p>
            </div>
            <p className="device-hint">
                {width >= 768 ? 'Try rotating to landscape or switch to a laptop/desktop.' : 'Please switch to a desktop or laptop to continue.'}
            </p>
        </div>
    );
}

function CameraGate({ onGranted }) {
    const [status, setStatus] = useState('idle');
    const requestCamera = async () => {
        setStatus('requesting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            onGranted(stream);
        } catch (err) {
            setStatus(err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' ? 'denied' : 'error');
        }
    };
    return (
        <div className="camera-gate card">
            <div className="camera-gate-icon"><Camera size={40} color="var(--primary)" /></div>
            <h2>Camera Access Required</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                This assessment requires camera access for proctoring. Snapshots are taken only on tab switches. No video is recorded.
            </p>
            {status === 'denied' && (
                <div className="alert alert-danger" style={{ marginBottom: 16, fontSize: 13 }}>
                    <AlertTriangle size={14} /> Camera access was denied. Allow it in your browser settings and refresh.
                </div>
            )}
            {status === 'error' && (
                <div className="alert alert-danger" style={{ marginBottom: 16, fontSize: 13 }}>
                    <AlertTriangle size={14} /> Could not access camera. Ensure one is connected and try again.
                </div>
            )}
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={requestCamera} disabled={status === 'requesting'}>
                <Camera size={16} /> {status === 'requesting' ? 'Requesting access…' : 'Allow Camera & Continue →'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14, textAlign: 'center' }}>
                You cannot proceed without granting camera access.
            </p>
        </div>
    );
}

export default function TestLanding() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCameraGate, setShowCameraGate] = useState(false);

    const handleStart = async (e) => {
        e.preventDefault();
        if (!email) { toast.error('Please enter your email address'); return; }
        setLoading(true);
        try {
            const res = await API.post('/candidate/verify', { token, email });
            sessionStorage.setItem('session_id', res.data.session_id);
            sessionStorage.setItem('candidate_id', String(res.data.candidate_id));
            sessionStorage.setItem('candidate_name', res.data.name);
            sessionStorage.setItem('questions', JSON.stringify(res.data.questions));
            sessionStorage.setItem('question_order', JSON.stringify(res.data.question_order));
            sessionStorage.setItem('test_token', token);
            sessionStorage.setItem('duration_minutes', String(res.data.duration_minutes || 60));
            sessionStorage.setItem('elapsed_seconds', String(res.data.elapsed_seconds || 0));
            sessionStorage.setItem('require_camera', String(res.data.require_camera || false));
            if (res.data.require_camera) {
                setShowCameraGate(true);
            } else {
                navigate(`/exam/${token}`);
            }
        } catch (err) {
            const detail = err.response?.data?.detail || '';
            if (detail === 'This test has already been submitted') {
                navigate('/result', { state: { alreadyTaken: true } });
            } else {
                toast.error(detail || 'Verification failed');
            }
        } finally {
            setLoading(false); }
    };

    const handleCameraGranted = (stream) => {
        window.__cameraStream = stream;
        navigate(`/exam/${token}`);
    };

    if (showCameraGate) {
        return (
            <>
                <DeviceBlock />
                <div className="landing-wrapper" style={{ justifyContent: 'center' }}>
                    <div style={{ maxWidth: 480, width: '100%' }}><CameraGate onGranted={handleCameraGranted} /></div>
                </div>
            </>
        );
    }

    return (
        <>
            <DeviceBlock />
            <div className="landing-wrapper">
                <div className="landing-left">
                    <div className="landing-brand"><div className="brand-dot">IA</div><span>InternAssess</span></div>
                    <h1>Welcome to the<br />Internship Assessment</h1>
                    <p>You have been invited to complete a timed MCQ assessment. A <strong>countdown timer</strong> is shown during the test — submit before it runs out.</p>
                    <div className="rules-box">
                        <h3>Before you begin:</h3>
                        <ul>
                            <li>✦ Do not switch tabs or minimize the browser</li>
                            <li>✦ Switching tabs 3 times will auto-submit your test</li>
                            <li>✦ Exiting full screen counts as a tab switch warning</li>
                            <li>✦ Questions are shuffled — each candidate sees a unique order</li>
                            <li>✦ You can navigate between questions freely</li>
                            <li>✦ Flag questions for review using the Flag button</li>
                            <li>✦ A confirmation summary is shown before final submission</li>
                            <li>✦ Ensure a stable internet connection</li>
                        </ul>
                    </div>
                </div>
                <div className="landing-right">
                    <div className="verify-card card">
                        <div className="verify-icon"><Shield size={28} color="var(--primary)" /></div>
                        <h2>Identity Verification</h2>
                        <p>Enter the email address associated with your test invitation to begin.</p>
                        <form onSubmit={handleStart} style={{ marginTop: 24 }}>
                            <div className="form-group">
                                <label><Mail size={12} style={{ marginRight: 4 }} />Your Email Address</label>
                                <input type="email" placeholder="Enter your registered email"
                                    value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
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
