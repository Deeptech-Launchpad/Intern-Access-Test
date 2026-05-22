import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Minus, Camera, FileText, Mail, Star, Clock, ShieldCheck, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout';
import API from '../../api';
import './CandidateDetail.css';

const ZOOM_STEP = 0.15;
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 4;

function LightboxViewer({ src, label, onClose }) {
    const [scale, setScale] = useState(1);

    const adjustZoom = React.useCallback((delta) => {
        setScale(s => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseFloat((s + delta).toFixed(2)))));
    }, []);

    // Scroll wheel zoom
    useEffect(() => {
        const onWheel = (e) => {
            e.preventDefault();
            adjustZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        };
        window.addEventListener('wheel', onWheel, { passive: false });
        return () => window.removeEventListener('wheel', onWheel);
    }, [adjustZoom]);

    // Arrow key zoom
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowUp'   || e.key === '+') { e.preventDefault(); adjustZoom(ZOOM_STEP); }
            if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); adjustZoom(-ZOOM_STEP); }
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [adjustZoom, onClose]);

    const pct = Math.round(scale * 100);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', zIndex: 99999, overflow: 'auto',
            }}
        >
            <img
                src={src}
                alt={label}
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    borderRadius: 10,
                    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                    display: 'block',
                    maxWidth: '90vw',
                    maxHeight: '80vh',
                    cursor: 'default',
                    transition: 'transform 0.15s ease',
                    margin: scale > 1 ? `${(scale - 1) * 40}vh ${(scale - 1) * 40}vw` : '0',
                }}
            />
            <div style={{ color: '#fff', fontSize: 13, marginTop: 20, opacity: 0.85, flexShrink: 0 }}>{label}</div>
            <div style={{ color: '#aaa', fontSize: 12, marginTop: 6, marginBottom: 16, flexShrink: 0 }}>
                Scroll or ↑ ↓ arrow keys to zoom · {pct}% · Click outside or Esc to close
            </div>
        </div>
    );
}

export default function CandidateDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [awardedMarks, setAwardedMarks] = useState({});
    const [finalizing, setFinalizing] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailSentStatus, setEmailSentStatus] = useState(() => {
        return localStorage.getItem('result_decision_' + id) || null;
    });
    const [lightbox, setLightbox] = useState(null); // { src, label }
    const [exporting, setExporting] = useState(false);

    const reload = () => {
        setLoading(true);
        API.get('/admin/candidate/' + id)
            .then(r => {
                setData(r.data);
                const init = {};
                (r.data.answers || []).forEach(ans => {
                    if (ans.question_type === 'descriptive' && ans.awarded_marks !== null && ans.awarded_marks !== undefined) {
                        init[ans.id] = ans.awarded_marks;
                    }
                });
                setAwardedMarks(init);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { reload(); }, [id]);

    if (loading) return <AdminLayout><div className="loading-center"><div className="spinner" /></div></AdminLayout>;
    if (!data) return <AdminLayout><p>Not found.</p></AdminLayout>;

    const getOptionText = (ans, opt) => {
        const map = { a: ans.option_a, b: ans.option_b, c: ans.option_c, d: ans.option_d };
        return map[opt] || '—';
    };
    const fmtTime = (iso) => {
        if (!iso) return '—';
        const utcStr = iso.endsWith('Z') ? iso : iso + 'Z';
        return new Date(utcStr).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true,
        }) + ' IST';
    };

    const descriptiveAnswers = (data.answers || []).filter(a => a.question_type === 'descriptive');
    const allMarksAwarded = descriptiveAnswers.length > 0 &&
        descriptiveAnswers.every(a => awardedMarks[a.id] !== undefined && awardedMarks[a.id] !== '');

    const handleFinalizeReview = async () => {
        // Validate every descriptive answer has a value in range before sending.
        // Blank = "not graded" — admin must explicitly type a value (0 is valid).
        const marks = {};
        let qNum = 0;
        for (const ans of (data?.answers || [])) {
            qNum += 1;
            if (ans.question_type !== 'descriptive') continue;
            const raw = awardedMarks[ans.id];
            if (raw === undefined || raw === '' || raw === null) {
                toast.error(`Q${qNum} is not graded yet — enter a mark (0 means awarded 0)`);
                return;
            }
            const val = parseInt(raw, 10);
            if (isNaN(val) || val < 0 || val > ans.question_mark) {
                toast.error(`Q${qNum}: marks must be between 0 and ${ans.question_mark}`);
                return;
            }
            marks[ans.id] = val;
        }
        setFinalizing(true);
        try {
            const res = await API.post('/admin/finalize-descriptive-by-candidate/' + id, { marks });
            toast.success(
                'Review finalized! Final score: ' + res.data.score + '/' + res.data.total +
                ' (' + res.data.percentage + '%)'
            );
            reload();
        } catch (e) {
            toast.error((e.response && e.response.data && e.response.data.detail) || 'Failed to finalize review');
        } finally {
            setFinalizing(false);
        }
    };

    const handleExportPDF = async () => {
        setExporting(true);
        try {
            const res = await API.get('/admin/candidate/' + id + '/export-pdf', { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safe = (data?.name || 'candidate').replace(/[^a-z0-9 _-]/gi, '_').replace(/\s+/g, '_');
            a.download = safe + '_result.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF downloaded');
        } catch (e) {
            const detail = e.response && e.response.data && e.response.data.detail;
            toast.error(detail || 'Failed to export PDF');
        } finally {
            setExporting(false);
        }
    };

    const handleSendEmail = async (decision) => {
        setSendingEmail(true);
        try {
            await API.post('/admin/send-result-email', {
                candidate_id: parseInt(id),
                decision: decision,
            });
            const label = decision === 'selected' ? 'Selected' : 'Rejected';
            toast.success(label + ' email sent to ' + data.email);
            setEmailSentStatus(decision);
            localStorage.setItem('result_decision_' + id, decision);
        } catch (e) {
            toast.error((e.response && e.response.data && e.response.data.detail) || 'Failed to send email');
        } finally {
            setSendingEmail(false);
        }
    };

    const isPendingReview = data.descriptive_status === 'pending_review';
    const isReviewed      = data.descriptive_status === 'reviewed';

    return (
        <AdminLayout>
            <div className="page-header" style={{ position: 'relative' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/grades')} style={{ marginBottom: 12 }}>
                    <ArrowLeft size={14} /> Back to Dashboard
                </button>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h1>{data.name}</h1>
                        <p>{data.email}</p>
                    </div>
                    {data.submitted_at && (
                        <button
                            className="btn btn-primary"
                            onClick={handleExportPDF}
                            disabled={exporting}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                        >
                            <Download size={14} /> {exporting ? 'Generating…' : 'Export as PDF'}
                        </button>
                    )}
                </div>
            </div>

            {/* Webcam Snapshots */}
            {data.require_camera && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Camera size={16} color="var(--primary)" />
                        <strong style={{ fontSize: 15 }}>Webcam Snapshots ({data.snapshots ? data.snapshots.length : 0})</strong>
                    </div>
                    {(!data.snapshots || data.snapshots.length === 0) ? (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No snapshots captured.</p>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                            {data.snapshots.map(snap => (
                                <div key={snap.id} style={{ textAlign: 'center', cursor: 'pointer' }}
                                    onClick={() => setLightbox({ src: 'data:image/jpeg;base64,' + snap.image_b64, label: 'Switch #' + snap.tab_switch_count + ' · ' + fmtTime(snap.captured_at) })}>
                                    <img
                                        src={'data:image/jpeg;base64,' + snap.image_b64}
                                        alt={'Switch #' + snap.tab_switch_count}
                                        style={{ width: 180, height: 135, objectFit: 'cover', borderRadius: 8, border: '2px solid #fecaca', display: 'block', transition: 'transform .15s', }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    />
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Switch #{snap.tab_switch_count}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtTime(snap.captured_at)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Lightbox — rendered via portal to escape AdminLayout overflow stacking context */}
            {lightbox && createPortal(
                <LightboxViewer
                    src={lightbox.src}
                    label={lightbox.label}
                    onClose={() => setLightbox(null)}
                />,
                document.body
            )}

            {/* Answer breakdown */}
            {data.answers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <p>No answers recorded yet.</p>
                </div>
            ) : (
                <div className="answers-list">
                    {data.answers.map((ans, i) => {

                        /* ── Descriptive answer card ── */
                        if (ans.question_type === 'descriptive') {
                            const currentVal = awardedMarks[ans.id] !== undefined
                                ? awardedMarks[ans.id]
                                : (ans.awarded_marks !== null && ans.awarded_marks !== undefined ? ans.awarded_marks : '');

                            return (
                                <div key={ans.id} className="answer-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                                    <div className="ans-header">
                                        <span className="qnum">Q{i + 1}</span>
                                        <p className="question-text">{ans.question}</p>
                                        <span style={{
                                            fontSize: 12, background: '#eff6ff', color: '#1d4ed8',
                                            padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', fontWeight: 600,
                                        }}>
                                            Descriptive · Max {ans.question_mark}M
                                        </span>
                                    </div>

                                    {/* Candidate's typed answer */}
                                    <div style={{ marginTop: 12, marginBottom: 14 }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Candidate's Answer
                                        </div>
                                        <div style={{
                                            background: '#f8fafc',
                                            border: '1px solid var(--border)',
                                            borderRadius: 8,
                                            padding: '12px 14px',
                                            fontSize: 14,
                                            lineHeight: 1.7,
                                            color: ans.descriptive_answer ? 'var(--text)' : 'var(--text-muted)',
                                            whiteSpace: 'pre-wrap',
                                            minHeight: 60,
                                        }}>
                                            {ans.descriptive_answer || '(No answer provided)'}
                                        </div>
                                    </div>

                                    {/* Mark awarding row — single input; click "Save & Finalize" at the bottom to persist.
                                        Empty input means "not graded yet" — distinct from typing 0 (which means "graded as 0"). */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Star size={14} color="#f59e0b" />
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>Award Marks:</span>
                                        </div>
                                        <input
                                            type="number"
                                            min={0}
                                            max={ans.question_mark}
                                            value={currentVal}
                                            onChange={e => setAwardedMarks(prev => ({ ...prev, [ans.id]: e.target.value }))}
                                            style={{
                                                width: 70, padding: '5px 8px', borderRadius: 6,
                                                border: '1.5px solid var(--border)', fontSize: 14, textAlign: 'center',
                                                fontStyle: currentVal === '' ? 'italic' : 'normal',
                                            }}
                                            placeholder="—"
                                        />
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ {ans.question_mark}</span>
                                        {ans.awarded_marks !== null && ans.awarded_marks !== undefined ? (
                                            <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
                                                ✓ Last saved: {ans.awarded_marks}M
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', fontWeight: 500 }}>
                                                Not graded yet
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        /* ── MCQ answer card (unchanged) ── */
                        const status = !ans.selected_option ? 'skipped' : ans.is_correct ? 'correct' : 'wrong';
                        return (
                            <div key={ans.id} className={'answer-card ' + status}>
                                <div className="ans-header">
                                    <span className="qnum">Q{i + 1}</span>
                                    <p className="question-text">{ans.question}</p>
                                    <span className={'status-icon ' + status}>
                                        {status === 'correct' && <CheckCircle size={18} />}
                                        {status === 'wrong'   && <XCircle size={18} />}
                                        {status === 'skipped' && <Minus size={18} />}
                                    </span>
                                </div>
                                <div className="options-grid">
                                    {['a', 'b', 'c', 'd'].map(opt => {
                                        const isCorrect  = ans.correct_answer === opt;
                                        const isSelected = ans.selected_option === opt;
                                        let cls = 'opt-row';
                                        if (isCorrect)              cls += ' opt-correct';
                                        if (isSelected && !isCorrect) cls += ' opt-wrong';
                                        if (isSelected && isCorrect)  cls += ' opt-selected-correct';
                                        return (
                                            <div key={opt} className={cls}>
                                                <span className="opt-label">{opt.toUpperCase()}</span>
                                                <span className="opt-text">{getOptionText(ans, opt)}</span>
                                                <span className="opt-tags">
                                                    {isCorrect && <span className="badge badge-success">Correct</span>}
                                                    {isSelected && !isCorrect && <span className="badge badge-danger">Your Answer</span>}
                                                    {isSelected && isCorrect  && <span className="badge badge-success">Your Answer ✓</span>}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Subject-Wise Score breakdown — shown below answers */}
            {data.subject_wise_scores && data.subject_wise_scores.length > 0 && (
                <div className="card" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
                    <div style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--border, #e5e7eb)',
                        background: '#f9fafb',
                    }}>
                        <strong style={{ fontSize: 12, letterSpacing: '0.08em', color: 'var(--text-muted, #6b7280)' }}>
                            SUBJECT-WISE SCORE
                        </strong>
                        {data.has_descriptive && data.descriptive_status === 'pending_review' && (
                            <span style={{ marginLeft: 12, fontSize: 11, color: '#d97706', fontWeight: 600 }}>
                                (MCQ-only — finalize descriptive review to include descriptive marks)
                            </span>
                        )}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                <th style={{ textAlign: 'left',  padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.06em', borderBottom: '1px solid var(--border, #e5e7eb)' }}>SUBJECT</th>
                                <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.06em', borderBottom: '1px solid var(--border, #e5e7eb)' }}>MAX. SCORE</th>
                                <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.06em', borderBottom: '1px solid var(--border, #e5e7eb)' }}>SCORE OBTAINED</th>
                                <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.06em', borderBottom: '1px solid var(--border, #e5e7eb)' }}>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.subject_wise_scores.map((s, idx) => {
                                const pctColor = s.percentage >= 80 ? '#059669'
                                               : s.percentage >= 60 ? '#d97706'
                                               : '#dc2626';
                                const isLast = idx === data.subject_wise_scores.length - 1;
                                return (
                                    <tr key={s.subject}>
                                        <td style={{ padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border, #f3f4f6)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: pctColor, display: 'inline-block', flexShrink: 0 }} />
                                            <strong style={{ fontWeight: 700, color: 'var(--text, #111827)' }}>{s.subject}</strong>
                                        </td>
                                        <td style={{ padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border, #f3f4f6)', textAlign: 'right', color: 'var(--text-muted, #6b7280)' }}>{s.max_score}</td>
                                        <td style={{ padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border, #f3f4f6)', textAlign: 'right', fontWeight: 700 }}>{s.score_obtained}</td>
                                        <td style={{ padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border, #f3f4f6)', textAlign: 'right', fontWeight: 700, color: pctColor }}>{s.percentage}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Summary cards — moved below subject score so the admin sees updated totals
                right where they clicked Save & Update Score, no scroll-up needed */}
            <div className="detail-stats" style={{ marginTop: 24 }}>
                <div className="stat-card">
                    <span>Score</span>
                    <strong>{data.score != null ? (data.score + ' / ' + data.total) : 'N/A'}</strong>
                </div>
                <div className="stat-card">
                    <span>Percentage</span>
                    <strong style={{ color: data.percentage >= 50 ? '#059669' : '#dc2626' }}>
                        {data.percentage != null ? (data.percentage + '%') : 'N/A'}
                    </strong>
                </div>
                <div className="stat-card">
                    <span><ShieldCheck size={12} style={{ marginRight: 4 }} />Trust Score</span>
                    <strong style={{
                        color: data.trust_score == null ? '#6b7280'
                              : data.trust_score >= 75 ? '#059669'
                              : data.trust_score >= 50 ? '#d97706'
                              : '#dc2626'
                    }}>
                        {data.trust_score != null ? data.trust_score + ' / 100' : 'N/A'}
                    </strong>
                    {data.trust_factors && data.trust_factors.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', marginTop: 4, lineHeight: 1.3 }}>
                            {data.trust_factors.join(' · ')}
                        </span>
                    )}
                    {data.trust_score === 100 && (
                        <span style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>
                            Clean — no flags
                        </span>
                    )}
                </div>
                <div className="stat-card">
                    <span><Clock size={12} style={{ marginRight: 4 }} />Time Taken</span>
                    <strong style={{ color: 'var(--text, #111827)' }}>
                        {data.time_taken_seconds != null
                            ? Math.floor(data.time_taken_seconds / 60) + ' min'
                            : 'N/A'
                        }
                        {data.duration_minutes != null && (
                            <span style={{ color: 'var(--text-muted, #6b7280)', fontWeight: 500 }}>
                                {' / ' + data.duration_minutes + ' min'}
                            </span>
                        )}
                    </strong>
                </div>
            </div>

            {/* Descriptive review status banner — placed AFTER subject score table */}
            {data.has_descriptive && (
                <div className="card" style={{ marginTop: 24, marginBottom: 24, borderLeft: '4px solid ' + (isPendingReview ? '#f59e0b' : '#059669') }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FileText size={18} color={isPendingReview ? '#f59e0b' : '#059669'} />
                            <div>
                                <strong style={{ fontSize: 15 }}>
                                    {isPendingReview ? 'Descriptive Answers — Pending Review' : 'Descriptive Answers — Reviewed ✓'}
                                </strong>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                                    {isPendingReview
                                        ? 'Enter marks in each descriptive answer above, then click Save and Update Score. Both happen in one click.'
                                        : 'All descriptive answers have been graded. Final score is reflected above.'}
                                </p>
                            </div>
                        </div>
                        {isPendingReview && (
                            <button
                                className="btn btn-primary"
                                onClick={handleFinalizeReview}
                                disabled={!allMarksAwarded || finalizing}
                                title={!allMarksAwarded ? 'Award marks to all descriptive questions first' : ''}
                            >
                                {finalizing ? 'Saving…' : '✓ Save and Update Score'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Result Email buttons — admin only — placed AFTER subject score table */}
            {data.submitted_at && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Mail size={16} color="var(--primary)" />
                        <strong style={{ fontSize: 15 }}>Send Result to Candidate</strong>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                        Send an official result email to <strong>{data.email}</strong>.
                        {data.has_descriptive && isPendingReview && (
                            <span style={{ color: '#f59e0b' }}> Note: Descriptive review is still pending.</span>
                        )}
                    </p>
                    {emailSentStatus ? (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                            background: emailSentStatus === 'selected' ? '#f0fdf4' : '#fef2f2',
                            border: '1.5px solid ' + (emailSentStatus === 'selected' ? '#86efac' : '#fca5a5'),
                            color: emailSentStatus === 'selected' ? '#166534' : '#991b1b',
                        }}>
                            {emailSentStatus === 'selected'
                                ? <><CheckCircle size={16} /> Candidate marked as Selected — email sent</>
                                : <><XCircle size={16} /> Candidate marked as Rejected — email sent</>
                            }
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <button
                                className="btn"
                                style={{ background: '#059669', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                                onClick={() => handleSendEmail('selected')}
                                disabled={sendingEmail}
                            >
                                <CheckCircle size={15} /> Send Selected Mail
                            </button>
                            <button
                                className="btn"
                                style={{ background: '#dc2626', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                                onClick={() => handleSendEmail('rejected')}
                                disabled={sendingEmail}
                            >
                                <XCircle size={15} /> Send Rejected Mail
                            </button>
                        </div>
                    )}
                </div>
            )}
        </AdminLayout>
    );
}
