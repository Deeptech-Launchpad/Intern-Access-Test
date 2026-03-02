import React from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import './TestResult.css';

export default function TestResult() {
    const { state } = useLocation();
    const autoSubmit = state?.autoSubmit || false;

    // Auto-submitted due to tab switching
    if (autoSubmit) {
        return (
            <div className="result-wrapper">
                <div className="result-card card">
                    <div className="result-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                        <AlertTriangle size={36} />
                    </div>
                    <h2 style={{ color: '#dc2626' }}>Test Auto-Submitted</h2>
                    <p className="auto-msg">
                        Your test was automatically submitted because you switched tabs or left the window <strong>3 times</strong>.
                    </p>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 12 }}>
                        Contact the admin for further assistance.
                    </p>
                </div>
            </div>
        );
    }

    // Normal submission — show only thank-you, no score
    return (
        <div className="result-wrapper">
            <div className="result-card card">
                <div className="result-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <CheckCircle size={36} />
                </div>

                <h2>Test Submitted!</h2>
                <p className="candidate-greeting">Thank You for completing the assessment.</p>

                <p style={{ textAlign: 'center', fontSize: 15, color: 'var(--text-muted)', marginTop: 24, lineHeight: 1.8 }}>
                    Your responses have been recorded and submitted for review.<br />
                    <strong>If you are selected</strong>, you will receive further information <strong>via email</strong>.
                </p>

                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
                    You may now close this window.
                </p>
            </div>
        </div>
    );
}
