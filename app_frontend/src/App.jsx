// App.jsx — updated with per-section dashboard routes

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider }   from "./context/AuthContext";
import { FilterProvider } from "./context/FilterContext";
import ProtectedRoute     from "./components/ProtectedRoute";
import Login            from "./pages/Login";
import Admin            from "./pages/Admin";
import DataManagement   from "./pages/DataManagement";
import Profile          from "./pages/Profile";

// Dashboard pages
import DashboardOverview  from "./pages/Dashboard";
import RevenuePage        from "./pages/dashboards/RevenuePage";
import FunnelPage         from "./pages/dashboards/FunnelPage";
import VehiclesPage       from "./pages/dashboards/VehiclesPage";
import ClientsPage        from "./pages/dashboards/ClientsPage";

const DASHBOARD_ROLES = [
  "Administrateur BI",
  "General Director",
  "Commercial Director",
  "Agency Manager",
  "Commercial",
];

export default function App() {
  return (
    <AuthProvider>
      <FilterProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Dashboard — overview (landing) */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                <DashboardOverview />
              </ProtectedRoute>
            } />

            {/* Dashboard — section pages */}
            <Route path="/dashboard/revenue" element={
              <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                <RevenuePage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/funnel" element={
              <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                <FunnelPage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/vehicles" element={
              <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                <VehiclesPage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/clients" element={
              <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                <ClientsPage />
              </ProtectedRoute>
            } />

            {/* Other pages */}
            <Route path="/profile" element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={["Administrateur BI"]}><Admin /></ProtectedRoute>
            } />
            <Route path="/data" element={
              <ProtectedRoute allowedRoles={["Administrateur BI"]}><DataManagement /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
      </FilterProvider>
    </AuthProvider>
  );
}
