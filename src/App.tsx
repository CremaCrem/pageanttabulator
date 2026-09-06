import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminShell } from './components/layout/AdminShell';
import { JudgeShell } from './components/layout/JudgeShell';

import { isTauri } from '@tauri-apps/api/core';

// Admin Pages
import { SetupPage } from './pages/admin/SetupPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { CandidatesPage } from './pages/admin/CandidatesPage';
import { CriteriaPage } from './pages/admin/CriteriaPage';
import { JudgeStatusPage } from './pages/admin/JudgeStatusPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { ResultsPage } from './pages/admin/ResultsPage';

// Judge Pages
import { JudgeSelectPage } from './pages/judge/JudgeSelectPage';
import { ScoringPage } from './pages/judge/ScoringPage';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

// Shared
import { ProjectionPage } from './pages/shared/ProjectionPage';

import './App.css';

function App() {
  // Detect if running inside the Tauri shell
  const isAdminMode = isTauri();

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
            <Route path="/results" element={<ResultsPage />} />
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
            <ErrorBoundary>
              <JudgeShell>
                <JudgeSelectPage />
              </JudgeShell>
            </ErrorBoundary>
          } />
          <Route path="/score" element={
            <ErrorBoundary>
              <JudgeShell>
                <ScoringPage />
              </JudgeShell>
            </ErrorBoundary>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
