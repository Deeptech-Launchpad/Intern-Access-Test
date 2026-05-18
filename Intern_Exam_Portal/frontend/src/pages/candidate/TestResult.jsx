import React from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, AlertTriangle, FileText, Lock } from 'lucide-react';
import './TestResult.css';

export default function TestResult() {
    const { state } = useLocation();
    const autoSubmit    = state && state.autoSubmit;
    const result        = state && state.result;
    const alreadyTaken  = state && state.alreadyTaken;
    const hasDescriptive = result && result.has_descriptive;

    // No state at all — user refreshed or navigated directly
    if (!state) {
        return (
            <div className="result-wrapper">
                <div className="result-card card">
                    <div className="result-icon" style={{ background: '#f0fdf4', color: '#059669' }}>
                        <CheckCircle size={36} />
                    </div>
                    <h2>Test Submitted</h2>
                    <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.7 }}>
                        Your test has already been submitted successfully.<br />
                        You may now close this window.
                    </p>
                </div>
            </div>
        );
    }

    // Already submitted — came from TestLanding catching the 400 error
    if (alreadyTaken) {
        return (
            <div className="result-wrapper">
                <div className="result-card card">
                    <div className="result-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                        <Lock size={36} />
                    </div>
                    <h2 style={{ color: '#dc2626' }}>Test Already Submitted</h2>
                    <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.7 }}>
                        You have already completed this assessment.<br />
                        This link can no longer be used to access the test.
                    </p>
                    <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        Contact the admin if you believe this is a mistake.
                    </p>
                </div>
            </div>
        );
    }

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

    return (
        <div className="result-wrapper">
            <div className="result-card card">
                <div className="result-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <CheckCircle size={36} />
                </div>

                <h2>Test Submitted!</h2>
                <p className="candidate-greeting">Thank you for completing the assessment.</p>

                {hasDescriptive ? (
                    <div style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 10,
                        padding: '16px 20px',
                        marginTop: 24,
                        textAlign: 'left',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <FileText size={16} color="#1d4ed8" />
                            <strong style={{ color: '#1d4ed8', fontSize: 14 }}>Descriptive Questions — Pending Review</strong>
                        </div>
                        <p style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.7, margin: 0 }}>
                            Your MCQ answers have been auto-graded. Your <strong>descriptive answers</strong> will be
                            reviewed and marked by the admin. Your final result will be communicated to you <strong>via email</strong> once the review is complete.
                        </p>
                    </div>
                ) : (
                    <p style={{ textAlign: 'center', fontSize: 15, color: 'var(--text-muted)', marginTop: 24, lineHeight: 1.8 }}>
                        Your responses have been recorded and submitted for review.<br />
                        <strong>If you are selected</strong>, you will receive further information <strong>via email</strong>.
                    </p>
                )}

                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
                    You may now close this window.
                </p>
            </div>
        </div>
    );
}
