import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Send, Flag, CheckCircle, XCircle, HelpCircle, Maximize, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';
import './TestPage.css';

function DeviceBlock() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const h = () => setWidth(window.innerWidth);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);
    if (width >= 1024) return null;
    return (
        <div className="device-block">
            <AlertTriangle size={56} strokeWidth={1.5} />
            <h2>Desktop / Laptop Required</h2>
            <p>Your screen: <strong>{width}px</strong> / Required: <strong>1024px</strong></p>
            <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>Rotate to landscape or switch to a larger device.</p>
        </div>
    );
}

function CountdownTimer({ durationMinutes, onExpire }) {
    const totalSeconds = durationMinutes * 60;
    const [remaining, setRemaining] = useState(() => {
        const elapsed = parseInt(sessionStorage.getItem('elapsed_seconds') || '0', 10);
        const localStart = sessionStorage.getItem('timer_local_start');
        let extra = 0;
        if (localStart) extra = Math.floor((Date.now() - Number(localStart)) / 1000);
        return Math.max(0, totalSeconds - elapsed - extra);
    });
    const expiredRef = useRef(false);

    useEffect(() => {
        if (!sessionStorage.getItem('timer_local_start')) {
            sessionStorage.setItem('timer_local_start', String(Date.now()));
        }
    }, []);

    useEffect(() => {
        if (remaining <= 0) {
            if (!expiredRef.current) { expiredRef.current = true; onExpire(); }
            return;
        }
        const iv = setInterval(() => {
            setRemaining(r => {
                const next = r - 1;
                if (next <= 0 && !expiredRef.current) { expiredRef.current = true; onExpire(); }
                return Math.max(0, next);
            });
        }, 1000);
        return () => clearInterval(iv);
    }, []);

    const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
    const secs = String(remaining % 60).padStart(2, '0');
    const isWarning = remaining <= 300 && remaining > 60;
    const isDanger  = remaining <= 60;
    return (
        <span className={`timer ${isWarning ? 'timer-warning' : ''} ${isDanger ? 'timer-danger' : ''}`}>
            <Clock size={15} style={{ marginRight: 4 }} />{mins}:{secs}
        </span>
    );
}

function SubmitModal({ questions, answers, descriptiveAnswers, flagged, onConfirm, onCancel, submitting }) {
    const mcqQuestions   = questions.filter(q => q.question_type !== 'descriptive');
    const descQuestions  = questions.filter(q => q.question_type === 'descriptive');
    const answeredMcq    = mcqQuestions.filter(q => answers[String(q.id)]).length;
    const answeredDesc   = descQuestions.filter(q => (descriptiveAnswers[String(q.id)] || '').trim().length > 0).length;
    const flaggedCnt     = questions.filter(q => flagged[String(q.id)]).length;
    const unansweredMcq  = mcqQuestions.length - answeredMcq;
    const unansweredDesc = descQuestions.length - answeredDesc;
    const totalUnanswered = unansweredMcq + unansweredDesc;
    return (
        <div className="sm-backdrop">
            <div className="sm-modal">
                <h3 className="sm-title"><Send size={18} /> Submit Test</h3>
                <p className="sm-sub">Review your progress before submitting.</p>
                <div className="sm-stats">
                    <div className="sm-stat sm-stat-green"><CheckCircle size={20} /><div><span>{answeredMcq + answeredDesc}</span><small>Answered</small></div></div>
                    <div className="sm-stat sm-stat-red"><XCircle size={20} /><div><span>{totalUnanswered}</span><small>Unanswered</small></div></div>
                    <div className="sm-stat sm-stat-amber"><Flag size={20} /><div><span>{flaggedCnt}</span><small>Flagged</small></div></div>
                    <div className="sm-stat sm-stat-gray"><HelpCircle size={20} /><div><span>{questions.length}</span><small>Total</small></div></div>
                </div>
                {descQuestions.length > 0 && (
                    <div className="sm-info" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>
                        <FileText size={14} />
                        This exam has <strong>{descQuestions.length}</strong> descriptive question{descQuestions.length !== 1 ? 's' : ''} that will be reviewed and graded by the admin.
                    </div>
                )}
                {totalUnanswered > 0 && (
                    <div className="sm-warning"><AlertTriangle size={14} />
                        You have <strong>{totalUnanswered}</strong> unanswered question{totalUnanswered !== 1 ? 's' : ''}.
                    </div>
                )}
                <div className="sm-actions">
                    <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>← Back to Test</button>
                    <button className="btn btn-primary" onClick={onConfirm} disabled={submitting}>
                        <Send size={14} /> {submitting ? 'Submitting…' : 'Confirm Submit'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function TestPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const sessionId     = Number(sessionStorage.getItem('session_id'));
    const candidateId   = Number(sessionStorage.getItem('candidate_id'));
    const candidateName = sessionStorage.getItem('candidate_name') || 'Candidate';
    const questions     = JSON.parse(sessionStorage.getItem('questions') || '[]');
    const durationMins  = Number(sessionStorage.getItem('duration_minutes') || 60);
    const requireCamera = sessionStorage.getItem('require_camera') === 'true';
    const alreadySubmitted = sessionStorage.getItem('test_submitted') === 'true';

    const [current,           setCurrent]           = useState(0);
    const [answers,           setAnswers]           = useState({});       // MCQ: {mcqId: 'a'/'b'/'c'/'d'}
    const [descriptiveAnswers, setDescriptiveAnswers] = useState({});     // descriptive: {mcqId: text}
    const [flagged,           setFlagged]           = useState({});
    const [tabWarnings,       setTabWarnings]       = useState(0);
    const [warningVisible,    setWarningVisible]    = useState(false);
    const [submitting,        setSubmitting]        = useState(false);
    const [showModal,         setShowModal]         = useState(false);
    const [isFullscreen,      setIsFullscreen]      = useState(false);
    const [fsPrompt,          setFsPrompt]          = useState(true);
    const autoSubmitRef = useRef(false);
    const cameraRef     = useRef(null);
    const streamRef     = useRef(null);
    const descSaveTimers = useRef({});  // debounce timers for descriptive autosave

    // ── Camera setup ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!requireCamera) return;
        if (window.__cameraStream) {
            streamRef.current = window.__cameraStream;
            if (cameraRef.current) cameraRef.current.srcObject = window.__cameraStream;
        } else {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    streamRef.current = stream;
                    if (cameraRef.current) cameraRef.current.srcObject = stream;
                    window.__cameraStream = stream;
                })
                .catch(() => toast.error('Camera access lost. Snapshots will not be taken.'));
        }
    }, [requireCamera]);

    // ── Capture webcam snapshot ──────────────────────────────────────────────
    const captureSnapshot = useCallback(async (tabSwitchCount) => {
        if (!requireCamera || !streamRef.current) return;
        try {
            const video = cameraRef.current;
            if (!video || video.readyState < 2) return;
            const canvas = document.createElement('canvas');
            canvas.width  = video.videoWidth  || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            // Mirror back to natural orientation for the snapshot
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
            try {
                await API.post('/candidate/snapshot', {
                    candidate_id: candidateId,
                    tab_switch_count: tabSwitchCount,
                    image_b64: b64,
                });
            } catch (e) { console.error('Snapshot upload failed', e); }
        } catch (e) { console.error('Snapshot capture failed', e); }
    }, [requireCamera, candidateId]);

    // ── Restore saved answers ────────────────────────────────────────────────
    useEffect(() => {
        if (!sessionId || questions.length === 0) { navigate('/'); return; }
        API.get(`/candidate/session/${sessionId}/answers`).then(r => {
            setAnswers(r.data.answers || {});
            setDescriptiveAnswers(r.data.descriptive_answers || {});
        }).catch(() => {});
    }, []);

    // ── Fullscreen ───────────────────────────────────────────────────────────
    const enterFullscreen = useCallback(() => {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        setFsPrompt(false);
    }, []);

    useEffect(() => {
        const onFsChange = () => {
            const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            setIsFullscreen(inFs);
            if (!inFs && !autoSubmitRef.current && !fsPrompt) {
                handleProctoringEvent('fullscreen-exit');
            }
        };
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('webkitfullscreenchange', onFsChange);
        };
    }, [fsPrompt]);

    // ── Proctoring ───────────────────────────────────────────────────────────
    const handleProctoringEvent = useCallback(async (source = 'tab') => {
        if (autoSubmitRef.current || showModal) return;
        try {
            const res = await API.post('/candidate/tab-switch', { session_id: sessionId, url: source });
            const count = res.data.tab_switches;
            setTabWarnings(count);
            setWarningVisible(true);
            setTimeout(() => setWarningVisible(false), 5000);
            await captureSnapshot(count);
            if (res.data.auto_submitted) {
                autoSubmitRef.current = true;
                sessionStorage.removeItem('timer_local_start');
                sessionStorage.setItem('test_submitted', 'true');
                toast.error('Test auto-submitted: 3 violations detected!', { duration: 8000 });
                navigate('/result', { state: { autoSubmit: true, tabSwitches: count } });
            }
        } catch (err) { console.error('Proctoring error:', err); }
    }, [sessionId, showModal, captureSnapshot]);

    useEffect(() => {
        const onVisibility = () => { if (document.hidden) handleProctoringEvent('tab-switch'); };
        const onBlur = () => handleProctoringEvent('window-blur');
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur', onBlur);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('blur', onBlur);
        };
    }, [handleProctoringEvent]);

    // ── Timer expire ─────────────────────────────────────────────────────────
    const handleTimerExpire = useCallback(async () => {
        if (autoSubmitRef.current) return;
        autoSubmitRef.current = true;
        toast.error('Time is up! Auto-submitting your test.', { duration: 6000 });
        sessionStorage.removeItem('timer_local_start');
        sessionStorage.setItem('test_submitted', 'true');
        try {
            const res = await API.post('/candidate/submit', { session_id: sessionId });
            navigate('/result', { state: { result: res.data, autoSubmit: true } });
        } catch { navigate('/result', { state: { autoSubmit: true } }); }
    }, [sessionId]);

    // ── MCQ Answer ────────────────────────────────────────────────────────────
    const handleAnswer = async (mcqId, option) => {
        setAnswers(prev => ({ ...prev, [String(mcqId)]: option }));
        try { await API.post('/candidate/answer', { session_id: sessionId, mcq_id: mcqId, selected_option: option }); }
        catch (e) { console.error('Save answer failed', e); }
    };

    // ── Descriptive Answer (debounced autosave) ───────────────────────────────
    const handleDescriptiveChange = (mcqId, text) => {
        setDescriptiveAnswers(prev => ({ ...prev, [String(mcqId)]: text }));
        // Debounce: save 1.5s after user stops typing
        if (descSaveTimers.current[mcqId]) clearTimeout(descSaveTimers.current[mcqId]);
        descSaveTimers.current[mcqId] = setTimeout(async () => {
            try {
                await API.post('/candidate/answer', {
                    session_id: sessionId,
                    mcq_id: mcqId,
                    descriptive_answer: text,
                });
            } catch (e) { console.error('Descriptive save failed', e); }
        }, 1500);
    };

    const toggleFlag = (mcqId) => setFlagged(prev => ({ ...prev, [String(mcqId)]: !prev[String(mcqId)] }));

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmitConfirmed = async () => {
        setSubmitting(true);
        // Flush any pending descriptive saves before submitting
        Object.keys(descSaveTimers.current).forEach(id => clearTimeout(descSaveTimers.current[id]));
        try {
            const res = await API.post('/candidate/submit', { session_id: sessionId });
            sessionStorage.removeItem('timer_local_start');
            sessionStorage.setItem('test_submitted', 'true');
            navigate('/result', { state: { result: res.data } });
        } catch { toast.error('Submission failed. Please try again.'); }
        finally { setSubmitting(false); }
    };

    // ── Already submitted guard ──────────────────────────────────────────
    useEffect(() => {
        if (alreadySubmitted) {
            navigate('/result', { state: { alreadyTaken: true } });
        }
    }, []);

    if (alreadySubmitted) return null;

    if (questions.length === 0) {
        return (
            <div className="loading-center" style={{ minHeight: '100vh' }}>
                <div className="spinner" /><span>Loading test...</span>
            </div>
        );
    }

    const q = questions[current];
    const isDescriptive = q.question_type === 'descriptive';
    const isFlagged = !!flagged[String(q.id)];

    // For sidebar answered count — MCQ answered OR descriptive has text
    const isAnswered = (question) => {
        if (question.question_type === 'descriptive') {
            return (descriptiveAnswers[String(question.id)] || '').trim().length > 0;
        }
        return !!answers[String(question.id)];
    };
    const answeredCount = questions.filter(isAnswered).length;

    const options = isDescriptive ? [] : [
        { key: 'a', text: q.option_a },
        { key: 'b', text: q.option_b },
        { key: 'c', text: q.option_c },
        { key: 'd', text: q.option_d },
    ];

    return (
        <>
            <DeviceBlock />
            {requireCamera && (
                <div style={{
                    position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
                    width: 160, height: 120, borderRadius: 10,
                    overflow: 'hidden', border: '2px solid #1d4ed8',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                    background: '#000',
                }}>
                    <video ref={cameraRef} autoPlay playsInline muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
                    <div style={{
                        position: 'absolute', bottom: 4, left: 0, right: 0,
                        textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.7)',
                        letterSpacing: '0.05em',
                    }}>LIVE</div>
                </div>
            )}

            {fsPrompt && (
                <div className="fs-prompt-overlay">
                    <div className="fs-prompt-card">
                        <Maximize size={36} color="var(--primary)" style={{ marginBottom: 16 }} />
                        <h3>Enter Full Screen to Begin</h3>
                        <p>This assessment must be taken in full screen mode. Exiting full screen will count as a violation.</p>
                        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 20 }} onClick={enterFullscreen}>
                            <Maximize size={16} /> Enter Full Screen & Start
                        </button>
                    </div>
                </div>
            )}

            <div className="test-wrapper">
                <header className="test-header">
                    <div className="th-left">
                        <div className="test-logo">IA</div>
                        <div>
                            <div className="test-title">InternAssess</div>
                            <div className="test-sub">Welcome, <strong>{candidateName}</strong></div>
                        </div>
                    </div>
                    <div className="th-center">
                        <CountdownTimer durationMinutes={durationMins} onExpire={handleTimerExpire} />
                        <span className="progress-info">{answeredCount}/{questions.length} answered</span>
                    </div>
                    <div className="th-right">
                        {tabWarnings > 0 && (
                            <span className="badge badge-danger" style={{ marginRight: 12 }}>
                                <AlertTriangle size={11} /> {tabWarnings} violation{tabWarnings > 1 ? 's' : ''}
                            </span>
                        )}
                        <button className="btn btn-primary" onClick={() => setShowModal(true)} disabled={submitting}>
                            <Send size={14} /> Submit Test
                        </button>
                    </div>
                </header>

                {warningVisible && (
                    <div className="tab-warning-banner">
                        <AlertTriangle size={16} />
                        ⚠️ Violation detected! ({tabWarnings}/3). Your test will be auto-submitted on the 3rd violation.
                    </div>
                )}

                <div className="test-body">
                    <aside className="progress-sidebar">
                        <h3>Questions</h3>
                        <div className="progress-grid">
                            {questions.map((ques, i) => {
                                const answered  = isAnswered(ques);
                                const isCurrent = i === current;
                                const isFlag    = !!flagged[String(ques.id)];
                                const isDesc    = ques.question_type === 'descriptive';
                                return (
                                    <button key={ques.id}
                                        className={`grid-cell ${answered ? 'answered' : ''} ${isCurrent ? 'current' : ''} ${isFlag ? 'flagged' : ''}`}
                                        onClick={() => setCurrent(i)}
                                        title={isDesc ? 'Descriptive' : isFlag ? 'Flagged' : answered ? 'Answered' : 'Unanswered'}>
                                        {i + 1}
                                        {isFlag && <span className="flag-dot" />}
                                        {isDesc && !isFlag && <span className="desc-dot" title="Descriptive" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="legend">
                            <div className="legend-item"><div className="legend-dot answered-dot" /><span>Answered</span></div>
                            <div className="legend-item"><div className="legend-dot current-dot" /><span>Current</span></div>
                            <div className="legend-item"><div className="legend-dot flagged-dot" /><span>Flagged</span></div>
                            <div className="legend-item"><div className="legend-dot unanswered-dot" /><span>Unanswered</span></div>
                        </div>
                    </aside>

                    <main className="question-panel">
                        <div className="question-header">
                            <span className="q-badge">
                                Question {current + 1} <span style={{ opacity: 0.6 }}>/ {questions.length}</span>
                                {isDescriptive && (
                                    <span style={{
                                        marginLeft: 10, fontSize: 11, background: '#eff6ff',
                                        color: '#1d4ed8', padding: '2px 8px', borderRadius: 4,
                                        fontWeight: 600, verticalAlign: 'middle',
                                    }}>
                                        Descriptive
                                    </span>
                                )}
                            </span>
                            <button className={`flag-btn ${isFlagged ? 'flag-btn-active' : ''}`}
                                onClick={() => toggleFlag(q.id)} title={isFlagged ? 'Remove flag' : 'Flag for review'}>
                                <Flag size={14} />{isFlagged ? 'Flagged' : 'Flag for Review'}
                            </button>
                        </div>

                        <div className="question-text">{q.question}</div>

                        {isDescriptive ? (
                            <div className="descriptive-section">
                                <textarea
                                    className="descriptive-textarea"
                                    placeholder="Write your answer here..."
                                    value={descriptiveAnswers[String(q.id)] || ''}
                                    onChange={e => handleDescriptiveChange(q.id, e.target.value)}
                                    rows={10}
                                />
                                <div className="descriptive-char-count">
                                    {(descriptiveAnswers[String(q.id)] || '').length} characters
                                </div>
                            </div>
                        ) : (
                            <div className="options-list">
                                {options.map((opt) => {
                                    const isSelected = answers[String(q.id)] === opt.key;
                                    return (
                                        <label key={opt.key} className={`option-item ${isSelected ? 'selected' : ''}`}>
                                            <input type="radio" name={`q-${q.id}`} checked={isSelected}
                                                onChange={() => handleAnswer(q.id, opt.key)} />
                                            <span className="opt-key">{opt.key.toUpperCase()}</span>
                                            <span className="opt-value">{opt.text}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        <div className="nav-buttons">
                            <button className="btn btn-ghost" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>← Previous</button>
                            <span className="nav-info">{current + 1} of {questions.length}</span>
                            <button className="btn btn-primary" disabled={current === questions.length - 1} onClick={() => setCurrent(c => c + 1)}>Next →</button>
                        </div>
                    </main>
                </div>
            </div>

            {showModal && (
                <SubmitModal
                    questions={questions}
                    answers={answers}
                    descriptiveAnswers={descriptiveAnswers}
                    flagged={flagged}
                    submitting={submitting}
                    onConfirm={handleSubmitConfirmed}
                    onCancel={() => setShowModal(false)}
                />
            )}
        </>
    );
}
