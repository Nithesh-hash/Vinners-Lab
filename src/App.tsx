import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Landing from './pages/Landing';
import ExploreComponents from './pages/ExploreComponents';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminScanReturn from './pages/AdminScanReturn';
import AdminScanRequest from './pages/AdminScanRequest';
import ReturnLoan from './pages/ReturnLoan';
import ProcessRequest from './pages/ProcessRequest';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<ExploreComponents />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route element={<Layout />}>
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty']}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/scan" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminScanReturn />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/scan-request" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminScanRequest />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/return-loan" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ReturnLoan />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/process-request" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ProcessRequest />
                </ProtectedRoute>
              } 
            />
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
