import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, AlertTriangle, RefreshCw, Eye, Briefcase, Filter, X, Clock } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import API from '../../api';
import './GradingDashboard.css';

export default function GradingDashboard() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [tabLogModal, setTabLogModal] = useState(null); // { name, log: [] }
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

    const jobPositions = [...new Set(candidates.map(c => c.job_position).filter(Boolean))];
    const displayed = filter ? candidates.filter(c => c.job_position === filter) : candidates;

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

    const fmtTime = (iso) => {
        const d = new Date(iso);
        // Convert UTC to IST display
        return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
    };

    const getStatusBadge = (c) => {
        if (c.status === 'submitted') return <span className="badge badge-success">Submitted</span>;
        if (c.status === 'not_attended') return <span className="badge badge-gray" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>Not Attended</span>;
        return <span className="badge badge-gray">Pending</span>;
    };

    return (
        <AdminLayout>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1>AI Grading Dashboard</h1>
                    <p>Auto-ranked by score · Tab-switch flags highlighted · Not Attended if link expired</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {jobPositions.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Filter size={14} color="var(--text-muted)" />
                            <select className="gd-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
                                <option value="">All Roles</option>
                                {jobPositions.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    )}
                    <button className="btn btn-ghost" onClick={fetchCandidates} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /><span>Loading candidates...</span></div>
            ) : displayed.length === 0 ? (
                <div className="empty-state">
                    <Trophy size={48} color="var(--border)" />
                    <h3>No candidates yet</h3>
                    <p>Generate test links and have candidates complete the test to see results here.</p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Name</th>
                                <th>Job Position</th>
                                <th>Experience</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Tab Switches</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayed.map((c) => (
                                <tr key={c.id} className={c.tab_switch_flagged ? 'flagged-row' : ''}>
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
                                        {c.assessment_title && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{c.assessment_title}</div>}
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
                                    <td>
                                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/candidate/${c.id}`)}>
                                            <Eye size={13} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
