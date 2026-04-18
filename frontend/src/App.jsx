import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';

import AppLayout from './components/common/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import CreateTicketPage from './pages/CreateTicketPage';
import KnowledgePage from './pages/KnowledgePage';
import KnowledgeArticlePage from './pages/KnowledgeArticlePage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import PlaceholderPage from './pages/PlaceholderPage';
import NotFoundPage from './pages/NotFoundPage';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner-primary" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />

    {/* Public */}
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

    {/* Protected - App Layout */}
    <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="dashboard"          element={<DashboardPage />} />
      <Route path="tickets"            element={<TicketsPage />} />
      <Route path="tickets/new"        element={<ProtectedRoute roles={['employee']}><CreateTicketPage /></ProtectedRoute>} />
      <Route path="tickets/:id"        element={<TicketDetailPage />} />
      <Route path="knowledge"          element={<KnowledgePage />} />
      <Route path="knowledge/:id"      element={<KnowledgeArticlePage />} />
      <Route path="profile"            element={<ProfilePage />} />
      
      {/* Admin Specific */}
      <Route path="admin/users"        element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
      <Route path="reports"            element={<ProtectedRoute roles={['admin']}><PlaceholderPage title="Reports" /></ProtectedRoute>} />
      <Route path="analytics"          element={<ProtectedRoute roles={['admin']}><PlaceholderPage title="Analytics" /></ProtectedRoute>} />
      <Route path="settings"           element={<ProtectedRoute roles={['admin']}><PlaceholderPage title="Settings" /></ProtectedRoute>} />
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <AppRoutes />
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
