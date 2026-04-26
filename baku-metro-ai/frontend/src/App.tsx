import { Navigate, Route, Routes } from "react-router-dom";

import AdminDashboard from "@/pages/AdminDashboard";
import AlertLogPage from "@/pages/AlertLogPage";
import LoginPage from "@/pages/LoginPage";
import StationMonitor from "@/pages/StationMonitor";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        {/* Root → login (admins) or kiosk operators navigate directly to /station. */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <AdminDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/alerts"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <AlertLogPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        {/* Station monitor is a public kiosk display — no login required. */}
        <Route
          path="/station"
          element={
            <ErrorBoundary>
              <StationMonitor />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
