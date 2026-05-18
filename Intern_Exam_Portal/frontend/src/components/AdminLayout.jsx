import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Link2, BarChart3, LogOut, Users, UserCog } from 'lucide-react';
import './AdminLayout.css';

const navItems = [
    { to: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard', end: true },
    { to: '/admin/create-assessment', icon: <PlusCircle size={18} />, label: 'Create Assessment' },
    { to: '/admin/generate', icon: <Link2 size={18} />, label: 'Generate Link' },
    { to: '/admin/grades', icon: <BarChart3 size={18} />, label: 'Grading Dashboard' },
    { to: '/admin/bulk-invite', icon: <Users size={18} />, label: 'Bulk Invite' },
    { to: '/admin/manage-admins', icon: <UserCog size={18} />, label: 'Manage Admins' },
];

export default function AdminLayout({ children }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        navigate('/admin/login');
    };

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="brand-icon">IA</div>
                    <div>
                        <div className="brand-title">InternAssess</div>
                        <div className="brand-subtitle">Admin Panel</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <button className="logout-btn" onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Logout</span>
                </button>
            </aside>

            {/* Main content */}
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
