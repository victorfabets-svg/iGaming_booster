import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import UserLayout from './components/UserLayout';
import MeHomePage from './pages/me/MeHomePage';
import MyTicketsPage from './pages/me/MyTicketsPage';
import MyRafflesPage from './pages/me/MyRafflesPage';
import MySubscriptionPage from './pages/me/MySubscriptionPage';
import MyTipsPage from './pages/me/MyTipsPage';
import MyProfilePage from './pages/me/MyProfilePage';
import HistoricoSection from './pages/sections/HistoricoSection';
import ConversionFlow from './pages/ConversionFlow';
import AdminLayout from './components/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import PartnerHousesPage from './pages/admin/PartnerHousesPage';
import PlansPage from './pages/admin/PlansPage';
import SubscriptionsPage from './pages/admin/SubscriptionsPage';
import TipsPage from './pages/admin/TipsPage';
import WhatsAppPage from './pages/admin/WhatsAppPage';
import IntegrationsPage from './pages/admin/IntegrationsPage';
import EmailTemplatesPage from './pages/admin/EmailTemplatesPage';
import AffiliatePage from './pages/admin/AffiliatePage';
import './styles/global.css';

// Protected route wrapper
function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Acesso Negado</h1>
        <p>Você não tem permissão para acessar esta página.</p>
        <a href="/">Voltar para página inicial</a>
      </div>
    );
  }

  return <>{children}</>;
}

// App with routes
function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
      
      {/* User routes - authenticated */}
      <Route
        path="/me"
        element={
          <ProtectedRoute>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MeHomePage />} />
        <Route path="upload" element={<ConversionFlow />} />
        <Route path="historico" element={<HistoricoSection />} />
        <Route path="tickets" element={<MyTicketsPage />} />
        <Route path="raffles" element={<MyRafflesPage />} />
        <Route path="subscription" element={<MySubscriptionPage />} />
        <Route path="tips" element={<MyTipsPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Route>

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="houses" element={<PartnerHousesPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="tips" element={<TipsPage />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="email-templates" element={<EmailTemplatesPage />} />
        <Route path="afiliados" element={<AffiliatePage />} />
      </Route>

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Root with providers
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);