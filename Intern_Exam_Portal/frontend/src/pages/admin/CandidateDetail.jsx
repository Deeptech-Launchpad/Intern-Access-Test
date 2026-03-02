import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import API from '../../api';
import './CandidateDetail.css';

export default function CandidateDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        API.get(`/admin/candidate/${id}`)
            .then(r => setData(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <AdminLayout><div className="loading-center"><div className="spinner" /></div></AdminLayout>;
    if (!data) return <AdminLayout><p>Not found.</p></AdminLayout>;

    const optionLabel = (opt) => opt ? opt.toUpperCase() : null;

    const getOptionText = (ans, opt) => {
        const map = { a: ans.option_a, b: ans.option_b, c: ans.option_c, d: ans.option_d };
        return map[opt] || '—';
    };

    return (
        <AdminLayout>
            {/* Header */}
            <div className="page-header">
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/grades')} style={{ marginBottom: 12 }}>
                    <ArrowLeft size={14} /> Back to Dashboard
                </button>
                <h1>{data.name}</h1>
                <p>{data.email}</p>
            </div>

            {/* Summary cards */}
            <div className="detail-stats">
                <div className="stat-card">
                    <span>Score</span>
                    <strong>{data.score != null ? `${data.score} / ${data.total}` : 'N/A'}</strong>
                </div>
                <div className="stat-card">
                    <span>Percentage</span>
                    <strong style={{ color: data.percentage >= 50 ? '#059669' : '#dc2626' }}>
                        {data.percentage != null ? `${data.percentage}%` : 'N/A'}
                    </strong>
                </div>
                <div className="stat-card">
                    <span>Tab Switches</span>
                    <strong style={{ color: data.tab_switches > 0 ? '#dc2626' : '#059669' }}>
                        {data.tab_switches > 0 ? <><AlertTriangle size={14} /> {data.tab_switches}</> : '0 (Clean)'}
                    </strong>
                </div>
                <div className="stat-card">
                    <span>Submitted At</span>
                    <strong>{data.submitted_at ? new Date(data.submitted_at).toLocaleString('en-IN') : 'Not submitted'}</strong>
                </div>
            </div>

            {/* Answer breakdown */}
            {data.answers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <p>No answers recorded yet.</p>
                </div>
            ) : (
                <div className="answers-list">
                    {data.answers.map((ans, i) => {
                        const status = !ans.selected_option ? 'skipped' : ans.is_correct ? 'correct' : 'wrong';
                        return (
                            <div key={ans.mcq_id} className={`answer-card ${status}`}>
                                <div className="ans-header">
                                    <span className="qnum">Q{i + 1}</span>
                                    <p className="question-text">{ans.question}</p>
                                    <span className={`status-icon ${status}`}>
                                        {status === 'correct' && <CheckCircle size={18} />}
                                        {status === 'wrong' && <XCircle size={18} />}
                                        {status === 'skipped' && <Minus size={18} />}
                                    </span>
                                </div>

                                <div className="options-grid">
                                    {['a', 'b', 'c', 'd'].map(opt => {
                                        const isCorrect = ans.correct_answer === opt;
                                        const isSelected = ans.selected_option === opt;
                                        let cls = 'opt-row';
                                        if (isCorrect) cls += ' opt-correct';
                                        if (isSelected && !isCorrect) cls += ' opt-wrong';
                                        if (isSelected && isCorrect) cls += ' opt-selected-correct';
                                        return (
                                            <div key={opt} className={cls}>
                                                <span className="opt-label">{opt.toUpperCase()}</span>
                                                <span className="opt-text">{getOptionText(ans, opt)}</span>
                                                <span className="opt-tags">
                                                    {isCorrect && <span className="badge badge-success">Correct</span>}
                                                    {isSelected && !isCorrect && <span className="badge badge-danger">Your Answer</span>}
                                                    {isSelected && isCorrect && <span className="badge badge-success">Your Answer ✓</span>}
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
        </AdminLayout>
    );
}
