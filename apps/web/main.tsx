import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';
import { ThemeProvider } from './state/ThemeContext';
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
import AdminLayout from './components/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import PartnerHousesPage from './pages/admin/PartnerHousesPage';
import PromotionsPage from './pages/admin/PromotionsPage';
import PlansPage from './pages/admin/PlansPage';
import SubscriptionsPage from './pages/admin/SubscriptionsPage';
import TipsPage from './pages/admin/TipsPage';
import WhatsAppPage from './pages/admin/WhatsAppPage';
import IntegrationsPage from './pages/admin/IntegrationsPage';
import EmailTemplatesPage from './pages/admin/EmailTemplatesPage';
import AffiliatePage from './pages/admin/AffiliatePage';
import UsersPage from './pages/admin/UsersPage';
import AffiliateLayout from './components/AffiliateLayout';
import AffiliateDashboardPage from './pages/affiliate/DashboardPage';
import AffiliateCampaignsPage from './pages/affiliate/CampaignsPage';
import './styles/global.css';

// Protected route wrapper
function ProtectedRoute({
  children,
  requireRole,
}: {
  children: React.ReactNode;
  requireRole?: ('admin' | 'affiliate' | 'user')[];
}) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If requireRole is specified, check user's role
  if (requireRole && requireRole.length > 0) {
    const userRole = user?.role as 'admin' | 'affiliate' | 'user' | undefined;
    if (!userRole || !requireRole.includes(userRole)) {
      return (
        <div className="card">
          <h1>Acesso Negado</h1>
          <p>Você não tem permissão para acessar esta página.</p>
          <a href="/">Voltar para página inicial</a>
        </div>
      );
    }
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
        <Route path="historico" element={<HistoricoSection />} />
        {/* Legacy /me/upload — proofs now must be tied to a promotion via
            the modal opened from /me. Redirect anyone with a stale link. */}
        <Route path="upload" element={<Navigate to="/me" replace />} />
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
          <ProtectedRoute requireRole={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="houses" element={<PartnerHousesPage />} />
        <Route path="promocoes" element={<PromotionsPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="tips" element={<TipsPage />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="email-templates" element={<EmailTemplatesPage />} />
        <Route path="afiliados" element={<AffiliatePage />} />
        <Route path="usuarios" element={<UsersPage />} />
      </Route>

      {/* Affiliate routes */}
      <Route
        path="/afiliado"
        element={
          <ProtectedRoute requireRole={['affiliate', 'admin']}>
            <AffiliateLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AffiliateDashboardPage />} />
        <Route path="campanhas" element={<AffiliateCampaignsPage />} />
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
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);