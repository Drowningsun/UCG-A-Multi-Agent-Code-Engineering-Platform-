import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import PageTransition from './components/PageTransition';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import GenUIChatPageV2 from './pages/GenUIChatPageV2';
import DashboardPage from './pages/DashboardPage';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
        <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
        {/* Chat routes - accessible to guests with usage limit */}
        <Route path="/chat" element={<GenUIChatPageV2 />} />
        <Route path="/chat/:sessionId" element={<GenUIChatPageV2 />} />
        {/* Dashboard requires authentication */}
        <Route path="/dashboard" element={
          <PageTransition>
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          </PageTransition>
        } />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="App">
          <AnimatedRoutes />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
