import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Link2, BarChart3, BookOpen, UserCog, Users, Download } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import './AdminDashboard.css';

const tiles = [
    {
        icon: <PlusCircle size={28} />,
        title: 'Create Assessment',
        desc: 'Define a job role, experience level, and upload MCQs',
        action: '/admin/create-assessment',
        color: '#1a56db',
    },
    {
        icon: <Link2 size={28} />,
        title: 'Generate Test Link',
        desc: 'Create a secure, encrypted link for a candidate',
        action: '/admin/generate',
        color: '#7c3aed',
    },
    {
        icon: <BarChart3 size={28} />,
        title: 'Grading Dashboard',
        desc: 'AI-ranked leaderboard with tab-switch alerts',
        action: '/admin/grades',
        color: '#059669',
    },
    {
        icon: <UserCog size={28} />,
        title: 'Manage Admins',
        desc: 'Create new admin accounts or remove existing ones',
        action: '/admin/manage-admins',
        color: '#d97706',
    },
    {
        icon: <Users size={28} />,
        title: 'Bulk Invite',
        desc: 'Upload a CSV to invite multiple candidates at once',
        action: '/admin/bulk-invite',
        color: '#0891b2',
    },
];

export default function AdminDashboard() {
    const navigate = useNavigate();
    return (
        <AdminLayout>
            <div className="page-header">
                <h1>Admin Dashboard</h1>
                <p>Manage MCQs, candidates, and review results from one place</p>
            </div>

            <div className="dash-tiles">
                {tiles.map((t) => (
                    <div key={t.title} className="dash-tile" onClick={() => navigate(t.action)}>
                        <div className="tile-icon" style={{ background: t.color + '18', color: t.color }}>
                            {t.icon}
                        </div>
                        <h3>{t.title}</h3>
                        <p>{t.desc}</p>
                        <span className="tile-arrow">→</span>
                    </div>
                ))}
            </div>

            <div className="dash-info card card-sm" style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <BookOpen size={18} color="var(--primary)" />
                        <strong>Excel Upload Format</strong>
                    </div>
                    <a
                        href="/sample_mcqs_template.xlsx"
                        download="sample_mcqs_template.xlsx"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: '#1a56db', color: '#fff', padding: '7px 16px',
                            borderRadius: 7, fontSize: 13, fontWeight: 600,
                            textDecoration: 'none', whiteSpace: 'nowrap',
                        }}
                    >
                        <Download size={14} /> Download Template
                    </a>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Your Excel file must have the following columns. Supports both <strong>MCQ</strong> and <strong>Descriptive</strong> questions in the same sheet.
                </p>

                {/* MCQ row format */}
                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a56db', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        MCQ Question Row
                    </div>
                    <div className="column-tags">
                        {['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'question_mark (blank)'].map(col => (
                            <code key={col} style={col.includes('blank') ? { opacity: 0.5 } : {}}>{col}</code>
                        ))}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                        Fill all options and set <code>correct_answer</code> to <code>a</code>, <code>b</code>, <code>c</code>, or <code>d</code>. Leave <code>question_mark</code> blank.
                    </p>
                </div>

                {/* Descriptive row format */}
                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Descriptive Question Row
                    </div>
                    <div className="column-tags">
                        {['question', 'option_a (blank)', 'option_b (blank)', 'option_c (blank)', 'option_d (blank)', 'correct_answer (blank)', 'question_mark'].map(col => (
                            <code key={col} style={col.includes('blank') ? { opacity: 0.5 } : { background: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' }}>{col}</code>
                        ))}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                        Leave options and <code>correct_answer</code> blank. Set <code>question_mark</code> to <code>2M</code>, <code>5M</code>, or <code>10M</code>. Admin will grade these manually.
                    </p>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: '#166534' }}>
                    💡 Both MCQ and Descriptive questions can be mixed in the same Excel file. Download the template above to see a ready-to-use example.
                </div>
            </div>
        </AdminLayout>
    );
}
