import { Route, Routes } from 'react-router-dom';
import SiteFooter from './components/SiteFooter.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ClinicDetailsPage from './pages/ClinicDetailsPage.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PatientDashboard from './pages/PatientDashboard.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/clinics/:clinicId" element={<ClinicDetailsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/patient" element={<ProtectedRoute roles={['patient']}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute roles={['staff']}><StaffDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}
