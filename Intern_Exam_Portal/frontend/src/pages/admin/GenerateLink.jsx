import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link2, Copy, Clock, User, Mail, CheckCircle, Briefcase, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout';
import API from '../../api';
import './GenerateLink.css';

export default function GenerateLink() {
    const [assessments, setAssessments] = useState([]);
    const [form, setForm] = useState({ name: '', email: '', assessment_id: '', mcq_set_name: '' });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [loadingAssessments, setLoadingAssessments] = useState(true);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        API.get('/admin/assessments')
            .then(res => {
                setAssessments(res.data);
                setLoadingAssessments(false);
                // Pre-select if navigated with ?assessment_id=X
                const preId = searchParams.get('assessment_id');
                if (preId) setForm(f => ({ ...f, assessment_id: preId }));
            })
            .catch(() => { toast.error('Failed to load assessments'); setLoadingAssessments(false); });
    }, []);

    const selectedAssessment = assessments.find(a => String(a.id) === String(form.assessment_id));
    const availableSets = selectedAssessment?.mcq_sets || [];

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email) { toast.error('Name and email are required'); return; }
        if (!form.assessment_id) { toast.error('Please select an assessment'); return; }
        setLoading(true);
        try {
            const payload = {
                name: form.name,
                email: form.email,
                assessment_id: parseInt(form.assessment_id),
                mcq_set_name: form.mcq_set_name || null,
                years_experience: 0,  // derived on backend from assessment.experience_level
            };
            const res = await API.post('/admin/generate-link', payload);
            setResult(res.data);
            if (res.data.email_sent) {
                toast.success(`Link generated & emailed to ${res.data.email}!`);
            } else {
                toast.success(`Link generated for ${res.data.name}`);
                toast('Email not sent — SMTP not configured in .env', { icon: '⚠️' });
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to generate link');
        } finally {
            setLoading(false);
        }
    };

    const copyLink = () => { navigator.clipboard.writeText(result.test_link); toast.success('Link copied!'); };
    const formatExpiry = (dt) => new Date(dt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
    const expLabel = (lvl) => lvl === 'experienced' ? 'Experienced' : 'Fresher';
    const expColor = (lvl) => lvl === 'experienced'
        ? { bg: '#fefce8', color: '#a16207', border: '#fde68a' }
        : { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };

    return (
        <AdminLayout>
            <div className="page-header">
                <h1>Generate Test Link</h1>
                <p>Create a unique encrypted test link for a candidate and send it via email</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 24, alignItems: 'start' }}>
                {/* ── Form ── */}
                <div className="card">
                    <form onSubmit={handleGenerate}>
                        {/* Assessment dropdown */}
                        <div className="form-group">
                            <label><Briefcase size={12} style={{ marginRight: 4 }} />Assessment / Job Role</label>
                            {loadingAssessments ? (
                                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading assessments…</p>
                            ) : assessments.length === 0 ? (
                                <p style={{ fontSize: 13, color: '#ef4444' }}>
                                    No assessments yet.{' '}
                                    <span style={{ color: 'var(--primary)', cursor: 'pointer' }}
                                        onClick={() => navigate('/admin/create-assessment')}>
                                        Create one first →
                                    </span>
                                </p>
                            ) : (
                                <select
                                    value={form.assessment_id}
                                    onChange={e => setForm({ ...form, assessment_id: e.target.value, mcq_set_name: '' })}
                                    className="gl-select">
                                    <option value="">— Select assessment —</option>
                                    {assessments.map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.job_position} · {a.title} ({expLabel(a.experience_level)}, {a.mcq_count} Qs)
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Assessment preview + MCQ set picker */}
                        {selectedAssessment && (
                            <>
                                <div className="gl-assessment-preview">
                                    <div className="gl-preview-row">
                                        <Briefcase size={13} />
                                        <span>{selectedAssessment.job_position}</span>
                                        <span className="gl-exp-badge" style={{
                                            background: expColor(selectedAssessment.experience_level).bg,
                                            color: expColor(selectedAssessment.experience_level).color,
                                            border: `1px solid ${expColor(selectedAssessment.experience_level).border}`,
                                        }}>
                                            {expLabel(selectedAssessment.experience_level)}
                                        </span>
                                    </div>
                                    <p className="gl-preview-title">
                                        {selectedAssessment.title} · {selectedAssessment.mcq_sets.length} set{selectedAssessment.mcq_sets.length !== 1 ? 's' : ''} · {selectedAssessment.mcq_count} total questions
                                    </p>
                                </div>

                                {/* MCQ Set picker — only shown if more than 1 set exists */}
                                {availableSets.length > 0 && (
                                    <div className="form-group">
                                        <label><Layers size={12} style={{ marginRight: 4 }} />Question Set</label>
                                        <select
                                            value={form.mcq_set_name}
                                            onChange={e => setForm({ ...form, mcq_set_name: e.target.value })}
                                            className="gl-select">
                                            <option value="">— All questions (any set) —</option>
                                            {availableSets.map(s => (
                                                <option key={s.set_name} value={s.set_name}>
                                                    {s.set_name} ({s.count} questions)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Candidate name */}
                        <div className="form-group">
                            <label><User size={12} style={{ marginRight: 4 }} />Candidate Name</label>
                            <input type="text" placeholder="e.g. John Doe"
                                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>

                        {/* Candidate email */}
                        <div className="form-group">
                            <label><Mail size={12} style={{ marginRight: 4 }} />Email Address</label>
                            <input type="email" placeholder="e.g. john@example.com"
                                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg"
                            style={{ width: '100%' }} disabled={loading}>
                            <Link2 size={16} />
                            {loading ? 'Generating...' : 'Generate & Send Link'}
                        </button>
                    </form>
                </div>

                {/* ── Result ── */}
                {result && (
                    <div className="card link-result">
                        <div className="result-header">
                            <CheckCircle size={24} color="#059669" />
                            <div>
                                <h3>Link Generated!</h3>
                                <p>Share this with <strong>{result.name}</strong></p>
                            </div>
                        </div>

                        <div className="gl-result-badges">
                            {result.job_position && <span className="gl-role-badge">{result.job_position}</span>}
                            {result.experience_level && (
                                <span className="gl-exp-badge" style={{
                                    background: expColor(result.experience_level).bg,
                                    color: expColor(result.experience_level).color,
                                    border: `1px solid ${expColor(result.experience_level).border}`,
                                }}>
                                    {expLabel(result.experience_level)}
                                </span>
                            )}
                            {result.mcq_set_name && (
                                <span className="gl-set-badge"><Layers size={11} /> {result.mcq_set_name}</span>
                            )}
                        </div>

                        <div className="link-box">
                            <span className="link-text">{result.test_link}</span>
                            <button className="btn btn-primary btn-sm" onClick={copyLink}>
                                <Copy size={13} /> Copy
                            </button>
                        </div>

                        <div className="expiry-note">
                            <Clock size={14} />
                            <span>Expires: <strong>{formatExpiry(result.expires_at)}</strong></span>
                        </div>

                        <div className="result-meta">
                            <div><span>Candidate ID</span><strong>#{result.candidate_id}</strong></div>
                            <div><span>Email</span><strong>{result.email}</strong></div>
                            {result.assessment_title && <div><span>Assessment</span><strong>{result.assessment_title}</strong></div>}
                            {result.mcq_set_name && <div><span>Question Set</span><strong>{result.mcq_set_name}</strong></div>}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
