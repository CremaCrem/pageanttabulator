import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminShell } from './components/layout/AdminShell';
import { JudgeShell } from './components/layout/JudgeShell';

// Admin Pages
import { SetupPage } from './pages/admin/SetupPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { CandidatesPage } from './pages/admin/CandidatesPage';
import { CriteriaPage } from './pages/admin/CriteriaPage';
import { JudgeStatusPage } from './pages/admin/JudgeStatusPage';
import { ReportsPage } from './pages/admin/ReportsPage';

// Judge Pages
import { JudgeSelectPage } from './pages/judge/JudgeSelectPage';
import { ScoringPage } from './pages/judge/ScoringPage';

// Shared
import { ProjectionPage } from './pages/shared/ProjectionPage';

import './App.css';

declare global {
  interface Window {
    __TAURI__?: boolean;
  }
}

function App() {
  // Detect if running inside the Tauri shell
  const isAdminMode = useMemo(() => {
    return Boolean(window.__TAURI__);
  }, []);

  return (
    <BrowserRouter>
      {isAdminMode ? (
        // --- Admin Mode (Tauri Shell) ---
        <AdminShell>
          <Routes>
            <Route path="/" element={<SetupPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/criteria" element={<CriteriaPage />} />
            <Route path="/judges" element={<JudgeStatusPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/projection" element={<ProjectionPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AdminShell>
      ) : (
        // --- Judge Mode (Browser) ---
        <Routes>
          <Route path="/projection" element={<ProjectionPage />} />
          <Route path="/" element={
            <JudgeShell>
              <JudgeSelectPage />
            </JudgeShell>
          } />
          <Route path="/score" element={
            <JudgeShell>
              <ScoringPage />
            </JudgeShell>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
