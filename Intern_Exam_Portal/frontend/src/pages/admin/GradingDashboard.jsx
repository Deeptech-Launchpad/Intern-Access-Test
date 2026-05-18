import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, AlertTriangle, RefreshCw, Eye, Briefcase, Filter, X, Clock, Download, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import API from '../../api';
import './GradingDashboard.css';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function GradingDashboard() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [jobFilter, setJobFilter] = useState('');
    const [assessmentFilter, setAssessmentFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [tabLogModal, setTabLogModal] = useState(null);
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [resendingId, setResendingId] = useState(null);
    const navigate = useNavigate();

    const fetchCandidates = async () => {
        setLoading(true);
        try {
            const res = await API.get('/admin/candidates');
            setCandidates(res.data.candidates);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCandidates(); }, []);

    const handleResendLink = async (candidateId, candidateName) => {
        setResendingId(candidateId);
        try {
            await API.post(`/admin/candidates/${candidateId}/resend-link`);
            toast.success(`New link sent to ${candidateName}!`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to resend link');
        } finally {
            setResendingId(null);
        }
    };

    // Unique job positions
    const jobPositions = useMemo(() =>
        [...new Set(candidates.map(c => c.job_position).filter(Boolean))].sort(),
        [candidates]
    );

    // Assessment names filtered by selected job position
    const assessmentNames = useMemo(() => {
        const source = jobFilter
            ? candidates.filter(c => c.job_position === jobFilter)
            : candidates;
        return [...new Set(source.map(c => c.assessment_title).filter(Boolean))].sort();
    }, [candidates, jobFilter]);

    // Reset assessment filter when job filter changes
    const handleJobFilterChange = (val) => {
        setJobFilter(val);
        setAssessmentFilter('');
        setCurrentPage(1);
    };

    const handleAssessmentFilterChange = (val) => {
        setAssessmentFilter(val);
        setCurrentPage(1);
    };

    // Apply filters
    const filtered = useMemo(() => {
        let list = candidates;
        if (jobFilter) list = list.filter(c => c.job_position === jobFilter);
        if (assessmentFilter) list = list.filter(c => c.assessment_title === assessmentFilter);
        if (statusFilter) list = list.filter(c => c.status === statusFilter);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
            );
        }
        return list;
    }, [candidates, jobFilter, assessmentFilter, statusFilter, searchQuery]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    const getRankBadge = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    const getPercentageColor = (pct) => {
        if (pct >= 80) return '#059669';
        if (pct >= 50) return '#d97706';
        return '#dc2626';
    };

    const expStyles = (lvl) => lvl === 'experienced'
        ? { background: '#fefce8', color: '#a16207', border: '1px solid #fde68a' }
        : { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' };

    // IST conversion
    const fmtTime = (iso) => {
        if (!iso) return '—';
        const utcStr = iso.endsWith('Z') ? iso : iso + 'Z';
        return new Date(utcStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
    };

    const getStatusBadge = (c) => {
        if (c.status === 'submitted') return <span className="badge badge-success">Submitted</span>;
        if (c.status === 'not_attended') return <span className="badge badge-gray" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>Not Attended</span>;
        return <span className="badge badge-gray">Pending</span>;
    };

    // Export to XLSX using SheetJS via CDN (loaded dynamically)
    const fmtTimeTaken = (startIso, endIso) => {
        if (!startIso || !endIso) return '—';
        const startMs = new Date(startIso.endsWith('Z') ? startIso : startIso + 'Z').getTime();
        const endMs   = new Date(endIso.endsWith('Z')   ? endIso   : endIso   + 'Z').getTime();
        const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const handleExport = async () => {
        const rows = filtered.map((c, idx) => ({
            'Rank': c.rank ? c.rank : '—',
            'Name': c.name,
            'Email': c.email,
            'Job Position': c.job_position || '—',
            'Assessment Name': c.assessment_title || '—',
            'Experience': c.experience_level === 'experienced' ? 'Experienced' : 'Fresher',
            'Score': c.score != null ? `${c.score}/${c.total}` : '—',
            'Percentage': c.percentage != null ? `${c.percentage}%` : '—',
            'Tab Switches': c.tab_switches,
            'Status': c.status === 'submitted' ? 'Submitted' : c.status === 'not_attended' ? 'Not Attended' : 'Pending',
            'Time Taken': fmtTimeTaken(c.started_at, c.submitted_at),
            'Submitted At (IST)': c.submitted_at ? fmtTime(c.submitted_at) : '—',
        }));

        // Dynamically load SheetJS
        if (!window.XLSX) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        const XLSX = window.XLSX;
        const ws = XLSX.utils.json_to_sheet(rows);
        // Auto column widths
        const colWidths = Object.keys(rows[0] || {}).map(key => ({
            wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2
        }));
        ws['!cols'] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        const label = assessmentFilter || jobFilter || 'All';
        XLSX.writeFile(wb, `grading_results_${label.replace(/\s+/g, '_')}.xlsx`);
    };

    const clearFilters = () => {
        setJobFilter('');
        setAssessmentFilter('');
        setStatusFilter('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    const hasActiveFilters = jobFilter || assessmentFilter || statusFilter || searchQuery;

    return (
        <AdminLayout>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1>AI Grading Dashboard</h1>
                    <p>Auto-ranked by score per assessment · Tab-switch flags highlighted · Not Attended if link expired</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" onClick={fetchCandidates} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                    {filtered.length > 0 && (
                        <button className="btn btn-outline" onClick={handleExport} title="Export filtered results to Excel">
                            <Download size={15} /> Export .xlsx
                        </button>
                    )}
                </div>
            </div>

            {/* Filters bar */}
            <div className="gd-filters-bar">
                <Filter size={14} color="var(--text-muted)" />
                <input
                    type="text"
                    className="gd-search-input"
                    placeholder="Search name or email…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
                <select className="gd-filter-select" value={jobFilter} onChange={e => handleJobFilterChange(e.target.value)}>
                    <option value="">All Job Positions</option>
                    {jobPositions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="gd-filter-select" value={assessmentFilter}
                    onChange={e => handleAssessmentFilterChange(e.target.value)} disabled={assessmentNames.length === 0}>
                    <option value="">All Assessments</option>
                    {assessmentNames.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select className="gd-filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                    <option value="">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="pending">Pending</option>
                    <option value="not_attended">Not Attended</option>
                </select>
                {hasActiveFilters && (
                    <button className="gd-clear-btn" onClick={clearFilters} title="Clear filters">
                        <X size={13} /> Clear
                    </button>
                )}
                <span className="gd-result-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /><span>Loading candidates...</span></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <Trophy size={48} color="var(--border)" />
                    <h3>No candidates found</h3>
                    <p>{hasActiveFilters ? 'No results match the selected filters.' : 'Generate test links and have candidates complete the test to see results here.'}</p>
                    {hasActiveFilters && <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={clearFilters}>Clear Filters</button>}
                </div>
            ) : (
                <>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Name</th>
                                    <th>Job Position</th>
                                    <th>Assessment</th>
                                    <th>Experience</th>
                                    <th>Score</th>
                                    <th>Percentage</th>
                                    <th>Tab Switches</th>
                                    <th>Status</th>
                                    <th>Submitted At (IST)</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((c) => (
                                    <tr key={`${c.id}-${c.assessment_title}`} className={c.tab_switch_flagged ? 'flagged-row' : ''}>
                                        <td>
                                            <span className="rank-badge">{c.rank ? getRankBadge(c.rank) : '—'}</span>
                                        </td>
                                        <td>
                                            <strong>{c.name}</strong>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>
                                        </td>
                                        <td>
                                            {c.job_position
                                                ? <span className="gd-role-pill"><Briefcase size={11} />{c.job_position}</span>
                                                : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                            }
                                        </td>
                                        <td>
                                            {c.assessment_title
                                                ? <span style={{ fontSize: 12 }}>{c.assessment_title}</span>
                                                : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                            }
                                        </td>
                                        <td>
                                            {c.experience_level
                                                ? <span className="gd-exp-badge" style={expStyles(c.experience_level)}>
                                                    {c.experience_level === 'experienced' ? 'Experienced' : 'Fresher'}
                                                </span>
                                                : '—'
                                            }
                                        </td>
                                        <td>
                                            {c.score != null
                                                ? <><strong>{c.score}</strong><span style={{ color: 'var(--text-muted)' }}>/{c.total}</span></>
                                                : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                            }
                                        </td>
                                        <td>
                                            {c.percentage != null ? (
                                                <div className="pct-bar-wrap">
                                                    <div className="pct-bar" style={{ width: `${c.percentage}%`, background: getPercentageColor(c.percentage) }} />
                                                    <span style={{ color: getPercentageColor(c.percentage), fontWeight: 700 }}>{c.percentage}%</span>
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td>
                                            {c.tab_switches > 0 ? (
                                                <button
                                                    className="badge badge-danger gd-tab-btn"
                                                    onClick={() => setTabLogModal({ name: c.name, log: c.tab_switch_log || [] })}
                                                    title="Click to see tab switch details"
                                                >
                                                    <AlertTriangle size={11} /> {c.tab_switches} switch{c.tab_switches > 1 ? 'es' : ''}
                                                </button>
                                            ) : (
                                                <span className="badge badge-success">Clean</span>
                                            )}
                                        </td>
                                        <td>{getStatusBadge(c)}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {fmtTime(c.submitted_at)}
                                        </td>
                                        <td>
                                            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/candidate/${c.id}`)}>
                                                <Eye size={13} /> View
                                            </button>
                                            {c.status !== 'submitted' && (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleResendLink(c.id, c.name)}
                                                    disabled={resendingId === c.id}
                                                    title="Generate a fresh link and re-send email"
                                                >
                                                    <Send size={13} /> {resendingId === c.id ? '…' : 'Resend'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="gd-pagination">
                        <div className="gd-page-size">
                            <label>Rows per page:</label>
                            <select
                                className="gd-filter-select"
                                value={pageSize}
                                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            >
                                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>

                        <span className="gd-page-info">
                            Page {safePage} of {totalPages}
                        </span>

                        <div className="gd-page-nav">
                            <button
                                className="gd-page-btn"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                            >
                                <ChevronLeft size={15} /> Previous
                            </button>
                            <button
                                className="gd-page-btn"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                            >
                                Next <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Tab Switch Log Modal */}
            {tabLogModal && (
                <div className="gd-modal-backdrop" onClick={() => setTabLogModal(null)}>
                    <div className="gd-modal" onClick={e => e.stopPropagation()}>
                        <div className="gd-modal-header">
                            <div>
                                <h3><AlertTriangle size={16} color="#dc2626" /> Tab Switch Log</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{tabLogModal.name}</p>
                            </div>
                            <button className="gd-modal-close" onClick={() => setTabLogModal(null)}><X size={18} /></button>
                        </div>
                        {tabLogModal.log.length === 0 ? (
                            <p style={{ fontSize: 14, color: 'var(--text-muted)', padding: '16px 0' }}>No detailed log available.</p>
                        ) : (
                            <ul className="gd-switch-log">
                                {tabLogModal.log.map((entry, i) => (
                                    <li key={i} className="gd-switch-entry">
                                        <span className="gd-switch-count">Switch #{entry.count}</span>
                                        <span className="gd-switch-url"><Clock size={11} /> {fmtTime(entry.time)}</span>
                                        {entry.url && entry.url !== 'unknown' && (
                                            <span className="gd-switch-to" title={entry.url}>→ {entry.url.length > 60 ? entry.url.slice(0, 57) + '…' : entry.url}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
