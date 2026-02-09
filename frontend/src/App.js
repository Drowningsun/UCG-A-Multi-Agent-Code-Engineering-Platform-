import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import GenUIChatPageV2 from './pages/GenUIChatPageV2';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="App">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            {/* Chat routes - accessible to guests with usage limit */}
            <Route path="/chat" element={<GenUIChatPageV2 />} />
            <Route path="/chat/:sessionId" element={<GenUIChatPageV2 />} />
            {/* Dashboard requires authentication */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
