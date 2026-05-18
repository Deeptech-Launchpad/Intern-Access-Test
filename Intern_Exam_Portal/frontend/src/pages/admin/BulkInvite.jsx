import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Briefcase, Layers, Users, Mail, Download, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout';
import DateTimePicker from '../../components/DateTimePicker';
import API from '../../api';
import './BulkInvite.css';

export default function BulkInvite() {
    const [assessments,        setAssessments]        = useState([]);
    const [assessmentId,       setAssessmentId]       = useState('');
    const [mcqSetName,         setMcqSetName]         = useState('');
    const [requireCamera,      setRequireCamera]      = useState(false);
    const [startDate,          setStartDate]          = useState('');
    const [endDate,            setEndDate]            = useState('');
    const [file,               setFile]               = useState(null);
    const [dragging,           setDragging]           = useState(false);
    const [loading,            setLoading]            = useState(false);
    const [results,            setResults]            = useState(null);
    const [loadingAssessments, setLoadingAssessments] = useState(true);
    const inputRef = useRef();

    const minDateTime = useMemo(() => new Date().toISOString(), []);

    useEffect(() => {
        API.get('/admin/assessments')
            .then(r => { setAssessments(r.data); setLoadingAssessments(false); })
            .catch(() => { toast.error('Failed to load assessments'); setLoadingAssessments(false); });
    }, []);

    const selectedAssessment = assessments.find(a => String(a.id) === String(assessmentId));
    const availableSets = selectedAssessment?.mcq_sets || [];
    const expLabel = (lvl) => lvl === 'experienced' ? 'Experienced' : 'Fresher';

    const handleFile = (f) => {
        if (!f) return;
        const n = f.name.toLowerCase();
        if (!n.endsWith('.csv') && !n.endsWith('.xlsx') && !n.endsWith('.xls')) {
            toast.error('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
            return;
        }
        setFile(f);
        setResults(null);
    };

    const handleDrop = (e) => {
        e.preventDefault(); setDragging(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleUpload = async () => {
        if (!assessmentId) { toast.error('Please select an assessment'); return; }
        if (!file)         { toast.error('Please select a CSV or Excel file'); return; }
        const now = new Date();
        if (startDate && new Date(startDate) < now) {
            toast.error('Opens At cannot be in the past'); return;
        }
        if (endDate && new Date(endDate) < now) {
            toast.error('Closes At cannot be in the past'); return;
        }
        if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
            toast.error('Closes At cannot be before Opens At'); return;
        }
        setLoading(true); setResults(null);
        try {
            const form = new FormData();
            form.append('file', file);
            let url = `/admin/bulk-invite?assessment_id=${assessmentId}&require_camera=${requireCamera}`;
            if (mcqSetName) url += `&mcq_set_name=${encodeURIComponent(mcqSetName)}`;
            if (startDate)  url += `&start_date=${encodeURIComponent(startDate)}`;
            if (endDate)    url += `&end_date=${encodeURIComponent(endDate)}`;
            const res = await API.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setResults(res.data);
            toast.success(`${res.data.invited} candidate${res.data.invited !== 1 ? 's' : ''} invited!`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Bulk invite failed');
        } finally { setLoading(false); }
    };

    const downloadTemplate = () => {
        const csv = 'name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'bulk_invite_template.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const invited = results?.results?.filter(r => r.status === 'invited') || [];
    const skipped = results?.results?.filter(r => r.status === 'skipped') || [];

    return (
        <AdminLayout>
            <div className="page-header">
                <h1>Bulk Candidate Invite</h1>
                <p>Upload a CSV or Excel file with candidate names and emails — links are generated and emailed in one shot</p>
            </div>

            <div className="bi-layout">
                {/* ── Left: Config + Upload ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Assessment picker */}
                    <div className="card">
                        <h3 className="bi-section-title"><Briefcase size={15} /> Assessment</h3>
                        {loadingAssessments ? (
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
                        ) : assessments.length === 0 ? (
                            <p style={{ fontSize: 13, color: '#ef4444' }}>No assessments found. Create one first.</p>
                        ) : (
                            <select className="bi-select" value={assessmentId}
                                onChange={e => { setAssessmentId(e.target.value); setMcqSetName(''); }}>
                                <option value="">— Select assessment —</option>
                                {assessments.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.job_position} · {a.title} ({expLabel(a.experience_level)}, {a.mcq_count} Qs)
                                    </option>
                                ))}
                            </select>
                        )}

                        {availableSets.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <label className="bi-label"><Layers size={12} /> Question Set (optional)</label>
                                <select className="bi-select" value={mcqSetName}
                                    onChange={e => setMcqSetName(e.target.value)}>
                                    <option value="">— All questions —</option>
                                    {availableSets.map(s => (
                                        <option key={s.set_name} value={s.set_name}>
                                            {s.set_name} ({s.count} questions)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{ marginTop: 12 }}>
                            <label className="bi-label"><Clock size={12} /> Opens At <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                            <DateTimePicker value={startDate} onChange={setStartDate} min={minDateTime} />
                        </div>
                        <div style={{ marginTop: 12 }}>
                            <label className="bi-label"><Clock size={12} /> Closes At <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                            <DateTimePicker value={endDate} onChange={setEndDate} min={startDate || minDateTime} />
                        </div>
                    </div>

                    {/* CSV Upload */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <h3 className="bi-section-title" style={{ marginBottom: 0 }}><Users size={15} /> Candidate CSV / Excel</h3>
                            <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
                                <Download size={13} /> Download Template
                            </button>
                        </div>

                        <div
                            className={`bi-drop-zone ${dragging ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => inputRef.current.click()}
                        >
                            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls"
                                style={{ display: 'none' }}
                                onChange={e => handleFile(e.target.files[0])} />
                            {file ? (
                                <>
                                    <FileSpreadsheet size={36} color="#059669" />
                                    <p className="bi-drop-name" style={{ color: '#059669' }}>{file.name}</p>
                                    <p className="bi-drop-sub">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                                        onClick={e => { e.stopPropagation(); setFile(null); setResults(null); }}>
                                        <X size={13} /> Remove
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Upload size={36} color="var(--primary)" style={{ opacity: 0.6 }} />
                                    <p className="bi-drop-name">Drag & drop CSV or Excel file here</p>
                                    <p className="bi-drop-sub">or click to browse · Accepts <code>.csv</code>, <code>.xlsx</code>, <code>.xls</code> · Must have <code>name</code> and <code>email</code> columns</p>
                                </>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary, #f9fafb)', borderRadius: 8, padding: '12px 16px', marginTop: 12 }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Require Camera Access</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Webcam required for all candidates in this batch.</div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, flexShrink: 0, marginLeft: 16, cursor: 'pointer' }}>
                                <input type="checkbox" checked={requireCamera} onChange={e => setRequireCamera(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                                <span style={{ position: 'absolute', inset: 0, borderRadius: 22, background: requireCamera ? 'var(--primary)' : '#d1d5db', transition: 'background 0.2s' }}>
                                    <span style={{ position: 'absolute', top: 3, left: requireCamera ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                </span>
                            </label>
                        </div>

                        <button className="btn btn-primary btn-lg"
                            style={{ width: '100%', marginTop: 16 }}
                            onClick={handleUpload}
                            disabled={loading || !file || !assessmentId}>
                            {loading
                                ? 'Sending invites…'
                                : <><Mail size={16} /> Send All Invites</>
                            }
                        </button>
                    </div>
                </div>

                {/* ── Right: Format guide + Results ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Format guide */}
                    <div className="card card-sm">
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>CSV / Excel Format</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                            Your file must have exactly these two columns (headers are case-insensitive). Works with <strong>.csv</strong>, <strong>.xlsx</strong>, and <strong>.xls</strong>:
                        </p>
                        <div className="bi-format-table">
                            <div className="bi-format-head">
                                <span>name</span><span>email</span>
                            </div>
                            <div className="bi-format-row">
                                <span>John Doe</span><span>john@example.com</span>
                            </div>
                            <div className="bi-format-row">
                                <span>Jane Smith</span><span>jane@example.com</span>
                            </div>
                        </div>
                        <div className="alert alert-warning" style={{ marginTop: 14, fontSize: 12 }}>
                            Existing candidates with the same email will have their link refreshed and re-sent.
                        </div>
                    </div>

                    {/* Results panel */}
                    {results && (
                        <div className="card">
                            <div className="bi-results-summary">
                                <div className="bi-result-stat bi-stat-green">
                                    <CheckCircle size={20} />
                                    <div>
                                        <span>{results.invited}</span>
                                        <small>Invited</small>
                                    </div>
                                </div>
                                {results.skipped > 0 && (
                                    <div className="bi-result-stat bi-stat-red">
                                        <AlertCircle size={20} />
                                        <div>
                                            <span>{results.skipped}</span>
                                            <small>Skipped</small>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {invited.length > 0 && (
                                <div className="bi-result-list">
                                    <p className="bi-result-label"><CheckCircle size={12} color="#059669" /> Invited</p>
                                    {invited.map((r, i) => (
                                        <div key={i} className="bi-result-row bi-row-success">
                                            <div>
                                                <strong>{r.name}</strong>
                                                <span>{r.email}</span>
                                            </div>
                                            <span className="bi-row-tag">Link sent</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {skipped.length > 0 && (
                                <div className="bi-result-list" style={{ marginTop: 12 }}>
                                    <p className="bi-result-label"><AlertCircle size={12} color="#dc2626" /> Skipped</p>
                                    {skipped.map((r, i) => (
                                        <div key={i} className="bi-result-row bi-row-error">
                                            <div>
                                                <strong>{r.name || '(no name)'}</strong>
                                                <span>{r.email || '(no email)'}</span>
                                            </div>
                                            <span className="bi-row-tag bi-tag-error">{r.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
