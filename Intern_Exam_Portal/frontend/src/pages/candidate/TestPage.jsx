import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';
import './TestPage.css';

// ─── Device Block ─────────────────────────────────────────────────────────────
function DeviceBlock() {
    return (
        <div className="device-block">
            <AlertTriangle size={64} strokeWidth={1.5} />
            <h2>Desktop / Laptop Required</h2>
            <p>This assessment is only available on screens ≥ 1024px wide.</p>
        </div>
    );
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function Timer({ startAt }) {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const start = Date.now() - elapsed * 1000;
        const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
        return () => clearInterval(iv);
    }, []);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    return <span className="timer">{mins}:{secs}</span>;
}

export default function TestPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    // Load from session storage
    const sessionId = Number(sessionStorage.getItem('session_id'));
    const candidateName = sessionStorage.getItem('candidate_name') || 'Candidate';
    const questions = JSON.parse(sessionStorage.getItem('questions') || '[]');

    const [current, setCurrent] = useState(0);
    const [answers, setAnswers] = useState({}); // { mcq_id: selected_option }
    const [tabWarnings, setTabWarnings] = useState(0);
    const [warningVisible, setWarningVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const autoSubmitRef = useRef(false);

    // Restore saved answers on mount
    useEffect(() => {
        if (!sessionId || questions.length === 0) {
            navigate('/');
            return;
        }
        API.get(`/candidate/session/${sessionId}/answers`).then(r => {
            setAnswers(r.data.answers || {});
        }).catch(() => { });
    }, []);

    // ─── Proctoring ──────────────────────────────────────────────────────────

    const handleProctoringEvent = useCallback(async () => {
        if (autoSubmitRef.current || submitted) return;
        try {
            const res = await API.post('/candidate/tab-switch', { session_id: sessionId });
            const count = res.data.tab_switches;
            setTabWarnings(count);
            setWarningVisible(true);
            setTimeout(() => setWarningVisible(false), 5000);

            if (res.data.auto_submitted) {
                autoSubmitRef.current = true;
                toast.error('Test auto-submitted: 3 tab switches detected!', { duration: 8000 });
                navigate('/result', { state: { autoSubmit: true, tabSwitches: count } });
            }
        } catch (err) {
            console.error('Proctoring error:', err);
        }
    }, [sessionId, submitted]);

    useEffect(() => {
        const onVisibility = () => { if (document.hidden) handleProctoringEvent(); };
        const onBlur = () => handleProctoringEvent();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur', onBlur);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('blur', onBlur);
        };
    }, [handleProctoringEvent]);

    // ─── Answer ───────────────────────────────────────────────────────────────

    const handleAnswer = async (mcqId, option) => {
        setAnswers(prev => ({ ...prev, [String(mcqId)]: option }));
        try {
            await API.post('/candidate/answer', { session_id: sessionId, mcq_id: mcqId, selected_option: option });
        } catch (err) {
            toast.error('Failed to save answer. Check your connection.');
        }
    };

    // ─── Submit ───────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        const unanswered = questions.length - Object.keys(answers).length;
        if (unanswered > 0) {
            const ok = window.confirm(`You have ${unanswered} unanswered question(s). Are you sure you want to submit?`);
            if (!ok) return;
        }
        setSubmitting(true);
        try {
            const res = await API.post('/candidate/submit', { session_id: sessionId });
            sessionStorage.setItem('result', JSON.stringify(res.data));
            navigate('/result', { state: { result: res.data } });
        } catch (err) {
            toast.error('Submission failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (questions.length === 0) {
        return (
            <div className="loading-center" style={{ minHeight: '100vh' }}>
                <div className="spinner" />
                <span>Loading test...</span>
            </div>
        );
    }

    const q = questions[current];
    const answeredCount = Object.keys(answers).length;

    const options = [
        { key: 'a', text: q.option_a },
        { key: 'b', text: q.option_b },
        { key: 'c', text: q.option_c },
        { key: 'd', text: q.option_d },
    ];

    return (
        <>
            <DeviceBlock />
            <div className="test-wrapper">
                {/* ─── Header ────────────────────────────────────────────────────── */}
                <header className="test-header">
                    <div className="th-left">
                        <div className="test-logo">IA</div>
                        <div>
                            <div className="test-title">InternAssess</div>
                            <div className="test-sub">Welcome, <strong>{candidateName}</strong></div>
                        </div>
                    </div>
                    <div className="th-center">
                        <Timer />
                        <span className="progress-info">{answeredCount}/{questions.length} answered</span>
                    </div>
                    <div className="th-right">
                        {tabWarnings > 0 && (
                            <span className="badge badge-danger" style={{ marginRight: 12 }}>
                                <AlertTriangle size={11} /> {tabWarnings} tab switch{tabWarnings > 1 ? 'es' : ''}
                            </span>
                        )}
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                            <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Test'}
                        </button>
                    </div>
                </header>

                {/* ─── Tab Switch Warning Banner ──────────────────────────────────── */}
                {warningVisible && (
                    <div className="tab-warning-banner">
                        <AlertTriangle size={16} />
                        ⚠️ Tab switch detected! ({tabWarnings}/3). Your test will be auto-submitted on the 3rd switch.
                    </div>
                )}

                <div className="test-body">
                    {/* ─── Sidebar (Progress Grid) ──────────────────────────────────── */}
                    <aside className="progress-sidebar">
                        <h3>Question Progress</h3>
                        <div className="progress-grid">
                            {questions.map((q, i) => {
                                const isAnswered = !!answers[String(q.id)];
                                const isCurrent = i === current;
                                return (
                                    <button
                                        key={q.id}
                                        className={`grid-cell ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}`}
                                        onClick={() => setCurrent(i)}
                                    >
                                        {i + 1}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="legend">
                            <div className="legend-item"><div className="legend-dot answered-dot" /><span>Answered</span></div>
                            <div className="legend-item"><div className="legend-dot current-dot" /><span>Current</span></div>
                            <div className="legend-item"><div className="legend-dot unanswered-dot" /><span>Unanswered</span></div>
                        </div>
                    </aside>

                    {/* ─── Question Panel ───────────────────────────────────────────── */}
                    <main className="question-panel">
                        <div className="question-header">
                            <span className="q-badge">Question {current + 1} <span style={{ opacity: 0.6 }}>/ {questions.length}</span></span>
                        </div>

                        <div className="question-text">{q.question}</div>

                        <div className="options-list">
                            {options.map((opt) => {
                                const isSelected = answers[String(q.id)] === opt.key;
                                return (
                                    <label
                                        key={opt.key}
                                        className={`option-item ${isSelected ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name={`q-${q.id}`}
                                            checked={isSelected}
                                            onChange={() => handleAnswer(q.id, opt.key)}
                                        />
                                        <span className="opt-key">{opt.key.toUpperCase()}</span>
                                        <span className="opt-value">{opt.text}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Navigation */}
                        <div className="nav-buttons">
                            <button
                                className="btn btn-ghost"
                                disabled={current === 0}
                                onClick={() => setCurrent(c => c - 1)}
                            >
                                ← Previous
                            </button>
                            <span className="nav-info">{current + 1} of {questions.length}</span>
                            <button
                                className="btn btn-primary"
                                disabled={current === questions.length - 1}
                                onClick={() => setCurrent(c => c + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
