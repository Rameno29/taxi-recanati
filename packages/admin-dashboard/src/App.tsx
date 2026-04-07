import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken } from "./services/api";
import { connectSocket, disconnectSocket } from "./services/socket";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RidesPage from "./pages/RidesPage";
import DriversPage from "./pages/DriversPage";
import MapPage from "./pages/MapPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AuditPage from "./pages/AuditPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getToken();

  useEffect(() => {
    if (token) {
      try { connectSocket(); } catch { /* no token yet */ }
    }
    return () => { disconnectSocket(); };
  }, [token]);

  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/rides" element={<RidesPage />} />
          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
