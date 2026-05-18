import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import GenerateLink from './pages/admin/GenerateLink';
import GradingDashboard from './pages/admin/GradingDashboard';
import CandidateDetail from './pages/admin/CandidateDetail';
import ManageAdmins from './pages/admin/ManageAdmins';
import BulkInvite from './pages/admin/BulkInvite';
import CreateAssessment from './pages/admin/CreateAssessment';

// Candidate pages
import TestLanding from './pages/candidate/TestLanding';
import TestPage from './pages/candidate/TestPage';
import TestResult from './pages/candidate/TestResult';

// Guard
function AdminGuard({ children }) {
  const token = localStorage.getItem('admin_token');
  return token ? children : <Navigate to="/admin/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif', fontSize: 14 },
          duration: 3500,
        }}
      />
      <Routes>
        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
        <Route path="/admin/create-assessment" element={<AdminGuard><CreateAssessment /></AdminGuard>} />
        <Route path="/admin/generate" element={<AdminGuard><GenerateLink /></AdminGuard>} />
        <Route path="/admin/grades" element={<AdminGuard><GradingDashboard /></AdminGuard>} />
        <Route path="/admin/candidate/:id" element={<AdminGuard><CandidateDetail /></AdminGuard>} />
        <Route path="/admin/manage-admins" element={<AdminGuard><ManageAdmins /></AdminGuard>} />
        <Route path="/admin/bulk-invite" element={<AdminGuard><BulkInvite /></AdminGuard>} />

        {/* Candidate routes */}
        <Route path="/test/:token" element={<TestLanding />} />
        <Route path="/exam/:token" element={<TestPage />} />
        <Route path="/result" element={<TestResult />} />

        {/* Default */}
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
