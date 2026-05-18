import React, { useState, useEffect, useRef } from 'react';
import {
    Briefcase, User2, CheckCircle, X, Plus, Trash2, Link2, Upload,
    FileSpreadsheet, ChevronDown, ChevronUp, Layers, Copy, Eye, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout';
import API from '../../api';
import './CreateAssessment.css';

// ─── MCQ Preview Modal ────────────────────────────────────────────────────────
function MCQPreviewModal({ assessment, setName, onClose }) {
    const [mcqs, setMcqs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const url = `/admin/assessments/${assessment.id}/mcqs${setName ? `?set_name=${encodeURIComponent(setName)}` : ''}`;
        API.get(url)
            .then(r => setMcqs(r.data))
            .catch(() => toast.error('Failed to load questions'))
            .finally(() => setLoading(false));
    }, [assessment.id, setName]);

    return (
        <div className="mp-backdrop">
            <div className="mp-modal">
                <div className="mp-header">
                    <div>
                        <h3><Eye size={16} /> Preview — {setName || 'All Questions'}</h3>
                        <p>{assessment.title} · {assessment.job_position}</p>
                    </div>
                    <button className="mp-close" onClick={onClose}><X size={18} /></button>
                </div>
                {loading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                ) : mcqs.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No questions found.</div>
                ) : (
                    <div className="mp-list">
                        {mcqs.map((mcq, i) => (
                            <div key={mcq.id} className="mp-item">
                                <div className="mp-q-row">
                                    <span className="mp-num">{i + 1}</span>
                                    <span className="mp-q">{mcq.question}</span>
                                    <span className="mp-set-tag">{mcq.set_name}</span>
                                </div>
                                {mcq.question_type === 'descriptive' ? (
                                    <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                                        Descriptive Question • {mcq.question_mark} Marks
                                    </div>
                                ) : (
                                    <div className="mp-opts">
                                        {['a','b','c','d'].map(k => (
                                            <div key={k} className={`mp-opt ${mcq.correct_answer === k ? 'mp-opt-correct' : ''}`}>
                                                <span className="mp-opt-key">{k.toUpperCase()}</span>
                                                <span>{mcq[`option_${k}`]}</span>
                                                {mcq.correct_answer === k && <CheckCircle size={12} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <div className="mp-footer">{mcqs.length} question{mcqs.length !== 1 ? 's' : ''}</div>
            </div>
        </div>
    );
}

export default function CreateAssessment() {
    const [title,       setTitle]       = useState('');
    const [jobPosition, setJobPosition] = useState('');
    const [expLevel,    setExpLevel]    = useState('fresher');
    const [durationMin, setDurationMin] = useState(60);
    const [creating,    setCreating]    = useState(false);

    const [titleSugs,    setTitleSugs]    = useState([]);
    const [jobSugs,      setJobSugs]      = useState([]);
    const [showTitleDrop, setShowTitleDrop] = useState(false);
    const [showJobDrop,   setShowJobDrop]   = useState(false);

    const [assessments, setAssessments] = useState([]);
    const [deletingId,  setDeletingId]  = useState(null);
    const [dupingId,    setDupingId]    = useState(null);
    const [expandedId,  setExpandedId]  = useState(null);

    const [uploadState,  setUploadState]  = useState({});
    const [previewModal, setPreviewModal] = useState(null); // { assessment, setName }

    const fileRefs = useRef({});
    const navigate = useNavigate();

    const loadAssessments = () => {
        API.get('/admin/assessments')
            .then(res => {
                setAssessments(res.data);
                setTitleSugs([...new Set(res.data.map(a => a.title))]);
                setJobSugs([...new Set(res.data.map(a => a.job_position))]);
            })
            .catch(() => {});
    };

    useEffect(() => { loadAssessments(); }, []);

    const filteredTitles = title
        ? titleSugs.filter(s => s.toLowerCase().includes(title.toLowerCase()) && s !== title)
        : titleSugs;
    const filteredJobs = jobPosition
        ? jobSugs.filter(s => s.toLowerCase().includes(jobPosition.toLowerCase()) && s !== jobPosition)
        : jobSugs;

    // ── Create Assessment ──────────────────────────────────────────────────
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!title.trim())      { toast.error('Assessment title is required'); return; }
        if (!jobPosition.trim()){ toast.error('Job position is required'); return; }
        if (durationMin < 5 || durationMin > 300) { toast.error('Duration must be 5–300 minutes'); return; }
        setCreating(true);
        try {
            await API.post('/admin/assessments', {
                title: title.trim(),
                job_position: jobPosition.trim(),
                experience_level: expLevel,
                duration_minutes: durationMin,
            });
            toast.success(`Assessment "${title.trim()}" created!`);
            setTitle(''); setJobPosition(''); setExpLevel('fresher'); setDurationMin(60);
            loadAssessments();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create assessment');
        } finally { setCreating(false); }
    };

    // ── Delete Assessment ──────────────────────────────────────────────────
    const handleDelete = async (a) => {
        if (!window.confirm(`Delete "${a.title}" (${a.job_position})?\nAll MCQ sets will also be deleted.`)) return;
        setDeletingId(a.id);
        try {
            await API.delete(`/admin/assessments/${a.id}`);
            toast.success(`Deleted "${a.title}"`);
            loadAssessments();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Delete failed');
        } finally { setDeletingId(null); }
    };

    // ── Duplicate Assessment ───────────────────────────────────────────────
    const handleDuplicate = async (a) => {
        setDupingId(a.id);
        try {
            await API.post(`/admin/assessments/${a.id}/duplicate`);
            toast.success(`Duplicated "${a.title}" → "${a.title} (Copy)"`);
            loadAssessments();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Duplicate failed');
        } finally { setDupingId(null); }
    };

    // ── MCQ Set Upload helpers ─────────────────────────────────────────────
    const getUpload = (id) => uploadState[id] || { setName: '', file: null, uploading: false, result: null };
    const setUpload = (id, patch) => setUploadState(prev => ({ ...prev, [id]: { ...getUpload(id), ...patch } }));

    const handleFileSelect = (assessmentId, f) => {
        if (!f) return;
        if (!f.name.match(/\.(xlsx|xls)$/)) { toast.error('Please select an .xlsx or .xls file'); return; }
        setUpload(assessmentId, { file: f, result: null });
    };

    const handleUploadSet = async (assessment) => {
        const u = getUpload(assessment.id);
        if (!u.file) { toast.error('Please select an Excel file first'); return; }
        const cleanSetName = (u.setName.trim()) || `Set ${assessment.mcq_sets.length + 1}`;
        setUpload(assessment.id, { uploading: true, result: null });
        try {
            const form = new FormData();
            form.append('file', u.file);
            const res = await API.post(
                `/admin/upload-mcqs?assessment_id=${assessment.id}&set_name=${encodeURIComponent(cleanSetName)}`,
                form, { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            setUpload(assessment.id, {
                uploading: false,
                result: { success: true, message: `✅ ${res.data.added} questions uploaded to "${res.data.set_name}"` },
                file: null, setName: '',
            });
            toast.success(res.data.message);
            loadAssessments();
        } catch (err) {
            const msg = err.response?.data?.detail || 'Upload failed';
            setUpload(assessment.id, { uploading: false, result: { success: false, message: msg } });
            toast.error(msg);
        }
    };

    const handleDeleteSet = async (assessment, setName) => {
        if (!window.confirm(`Delete question set "${setName}" from "${assessment.title}"?`)) return;
        try {
            await API.delete(`/admin/assessments/${assessment.id}/mcq-sets/${encodeURIComponent(setName)}`);
            toast.success(`Deleted set "${setName}"`);
            loadAssessments();
        } catch { toast.error('Failed to delete set'); }
    };

    const expLabel = (lvl) => lvl === 'experienced' ? 'Experienced' : 'Fresher';
    const expStyle = (lvl) => lvl === 'experienced'
        ? { bg: '#fefce8', color: '#a16207' }
        : { bg: '#f0fdf4', color: '#15803d' };

    return (
        <AdminLayout>
            <div className="page-header">
                <h1>Create Assessment</h1>
                <p>Set up a job-role assessment, then upload one or more MCQ question sets</p>
            </div>

            {/* ── Create form ──────────────────────────────────────────────── */}
            <form className="ca-form" onSubmit={handleCreate}>
                <div className="card ca-card ca-create-card">
                    <div className="ca-create-row">
                        {/* Assessment Title */}
                        <div className="ca-field" style={{ position: 'relative', flex: 1 }}>
                            <label>Assessment Title</label>
                            <input type="text" placeholder="e.g. Q1 2025 Intern Round"
                                value={title}
                                onChange={e => { setTitle(e.target.value); setShowTitleDrop(true); }}
                                onFocus={() => setShowTitleDrop(true)}
                                onBlur={() => setTimeout(() => setShowTitleDrop(false), 150)}
                                autoComplete="off" />
                            {showTitleDrop && filteredTitles.length > 0 && (
                                <ul className="ca-suggestions">
                                    {filteredTitles.map(s => (
                                        <li key={s} onMouseDown={() => { setTitle(s); setShowTitleDrop(false); }}>{s}</li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Job Position */}
                        <div className="ca-field" style={{ position: 'relative', flex: 1 }}>
                            <label><Briefcase size={13} style={{ marginRight: 4 }} />Job Position</label>
                            <input type="text" placeholder="e.g. Software Developer"
                                value={jobPosition}
                                onChange={e => { setJobPosition(e.target.value); setShowJobDrop(true); }}
                                onFocus={() => setShowJobDrop(true)}
                                onBlur={() => setTimeout(() => setShowJobDrop(false), 150)}
                                autoComplete="off" />
                            {showJobDrop && filteredJobs.length > 0 && (
                                <ul className="ca-suggestions">
                                    {filteredJobs.map(s => (
                                        <li key={s} onMouseDown={() => { setJobPosition(s); setShowJobDrop(false); }}>
                                            <Briefcase size={12} /> {s}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Experience Level */}
                        <div className="ca-field ca-exp-field">
                            <label><User2 size={13} style={{ marginRight: 4 }} />Experience</label>
                            <div className="ca-exp-group">
                                <label className={`ca-exp-option ${expLevel === 'fresher' ? 'active' : ''}`}>
                                    <input type="radio" name="exp" value="fresher"
                                        checked={expLevel === 'fresher'} onChange={() => setExpLevel('fresher')} />
                                    <div className="ca-exp-label"><span className="ca-exp-name">Fresher</span></div>
                                </label>
                                <label className={`ca-exp-option ${expLevel === 'experienced' ? 'active' : ''}`}>
                                    <input type="radio" name="exp" value="experienced"
                                        checked={expLevel === 'experienced'} onChange={() => setExpLevel('experienced')} />
                                    <div className="ca-exp-label"><span className="ca-exp-name">Experienced</span></div>
                                </label>
                            </div>
                        </div>

                        {/* Duration */}
                        <div className="ca-field ca-duration-field">
                            <label><Clock size={13} style={{ marginRight: 4 }} />Duration (mins)</label>
                            <input
                                type="number"
                                min={5} max={300}
                                value={durationMin}
                                onChange={e => setDurationMin(Number(e.target.value))}
                                className="ca-duration-input"
                            />
                        </div>

                        {/* Submit */}
                        <div className="ca-field ca-submit-field">
                            <label>&nbsp;</label>
                            <button type="submit" className="btn btn-primary" disabled={creating} style={{ width: '100%' }}>
                                {creating ? 'Creating…' : <><Plus size={15} /> Create Assessment</>}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* ── Assessment List ───────────────────────────────────────────── */}
            <div className="ca-list-section">
                <div className="ca-list-header">
                    <Layers size={18} color="var(--primary)" />
                    <h2>Assessments ({assessments.length})</h2>
                </div>

                {assessments.length === 0 ? (
                    <div className="ca-list-empty">No assessments yet — create your first one above.</div>
                ) : (
                    <div className="ca-list">
                        {assessments.map(a => {
                            const expanded = expandedId === a.id;
                            const u = getUpload(a.id);
                            return (
                                <div key={a.id} className="ca-list-item">
                                    <div className="ca-list-row">
                                        <div className="ca-list-info">
                                            <div className="ca-list-title">{a.title}</div>
                                            <div className="ca-list-meta">
                                                <span className="ca-list-role"><Briefcase size={11} /> {a.job_position}</span>
                                                <span className="ca-list-exp"
                                                    style={{ background: expStyle(a.experience_level).bg, color: expStyle(a.experience_level).color }}>
                                                    {expLabel(a.experience_level)}
                                                </span>
                                                <span className="ca-list-count">{a.mcq_count} questions · {a.mcq_sets.length} set{a.mcq_sets.length !== 1 ? 's' : ''}</span>
                                                <span className="ca-list-duration"><Clock size={11} /> {a.duration_minutes} min</span>
                                            </div>
                                        </div>
                                        <div className="ca-list-actions">
                                            <button className="btn btn-outline btn-sm"
                                                onClick={() => navigate(`/admin/generate?assessment_id=${a.id}`)}>
                                                <Link2 size={13} /> Send Link
                                            </button>
                                            {a.mcq_count > 0 && (
                                                <button className="btn btn-ghost btn-sm"
                                                    onClick={() => setPreviewModal({ assessment: a, setName: null })}>
                                                    <Eye size={13} /> Preview
                                                </button>
                                            )}
                                            <button className="btn btn-ghost btn-sm ca-upload-toggle"
                                                onClick={() => setExpandedId(expanded ? null : a.id)}>
                                                <Upload size={13} /> Upload MCQ Set
                                                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            </button>
                                            <button className="btn btn-ghost btn-sm"
                                                onClick={() => handleDuplicate(a)}
                                                disabled={dupingId === a.id}
                                                title="Clone this assessment with all its MCQs">
                                                <Copy size={13} /> {dupingId === a.id ? 'Cloning…' : 'Duplicate'}
                                            </button>
                                            <button className="ca-delete-btn"
                                                onClick={() => handleDelete(a)}
                                                disabled={deletingId === a.id}>
                                                <Trash2 size={14} />
                                                {deletingId === a.id ? '…' : 'Delete'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* MCQ Sets breakdown */}
                                    {a.mcq_sets.length > 0 && (
                                        <div className="ca-sets-list">
                                            {a.mcq_sets.map(s => (
                                                <div key={s.set_name} className="ca-set-chip">
                                                    <FileSpreadsheet size={12} />
                                                    <span className="ca-set-name">{s.set_name}</span>
                                                    <span className="ca-set-count">{s.count} Qs</span>
                                                    <button className="ca-set-preview"
                                                        onClick={() => setPreviewModal({ assessment: a, setName: s.set_name })}
                                                        title="Preview questions in this set">
                                                        <Eye size={11} />
                                                    </button>
                                                    <button className="ca-set-delete"
                                                        onClick={() => handleDeleteSet(a, s.set_name)}
                                                        title="Delete this set">
                                                        <X size={11} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Inline upload panel */}
                                    {expanded && (
                                        <div className="ca-upload-panel">
                                            <div className="ca-upload-panel-row">
                                                <input type="text" className="ca-set-name-input"
                                                    placeholder={`Set name (e.g. "Easy Set") — optional`}
                                                    value={u.setName}
                                                    onChange={e => setUpload(a.id, { setName: e.target.value })}
                                                />
                                            </div>
                                            <div className={`ca-drop-zone-inline ${u.file ? 'has-file' : ''} ${u.result?.success ? 'upload-success' : ''}`}
                                                onClick={() => { fileRefs.current[a.id]?.click(); }}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => { e.preventDefault(); handleFileSelect(a.id, e.dataTransfer.files[0]); }}>
                                                <input ref={el => fileRefs.current[a.id] = el}
                                                    type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                                                    onChange={e => handleFileSelect(a.id, e.target.files[0])} />
                                                {u.result?.success ? (
                                                    <><CheckCircle size={28} color="#059669" />
                                                        <p className="ca-drop-name" style={{ color: '#059669' }}>Upload Successful!</p>
                                                        <p className="ca-drop-sub">{u.result.message}</p></>
                                                ) : u.file ? (
                                                    <><FileSpreadsheet size={28} color="#059669" />
                                                        <p className="ca-drop-name">{u.file.name}</p>
                                                        <p className="ca-drop-sub">{(u.file.size / 1024).toFixed(1)} KB</p></>
                                                ) : (
                                                    <><Upload size={28} color="var(--primary)" style={{ opacity: 0.5 }} />
                                                        <p className="ca-drop-name">Drop Excel file or click to browse</p>
                                                        <p className="ca-drop-sub">.xlsx / .xls</p></>
                                                )}
                                            </div>
                                            {u.result && !u.result.success && (
                                                <div className="ca-upload-error"><X size={13} /> {u.result.message}</div>
                                            )}
                                            <button className="btn btn-primary btn-sm"
                                                onClick={() => handleUploadSet(a)}
                                                disabled={!u.file || u.uploading}>
                                                {u.uploading ? 'Uploading…' : <><Upload size={13} /> Upload Questions</>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── MCQ Preview Modal ──────────────────────────────────────────── */}
            {previewModal && (
                <MCQPreviewModal
                    assessment={previewModal.assessment}
                    setName={previewModal.setName}
                    onClose={() => setPreviewModal(null)}
                />
            )}
        </AdminLayout>
    );
}
