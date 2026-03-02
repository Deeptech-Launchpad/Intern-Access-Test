import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Link2, BarChart3, BookOpen, UserCog } from 'lucide-react';
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <BookOpen size={18} color="var(--primary)" />
                    <strong>Excel Upload Format</strong>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Your Excel file should have these exact column headers (case-insensitive):
                </p>
                <div className="column-tags">
                    {['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'].map(col => (
                        <code key={col}>{col}</code>
                    ))}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                    <strong>correct_answer</strong> must be one of: <code>a</code>, <code>b</code>, <code>c</code>, or <code>d</code>
                </p>
            </div>
        </AdminLayout>
    );
}
