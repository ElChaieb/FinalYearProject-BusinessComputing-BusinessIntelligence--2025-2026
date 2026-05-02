// App.jsx — updated with per-section dashboard routes

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FilterProvider } from "./context/FilterContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import DataManagement from "./pages/DataManagement";
import Profile from "./pages/Profile";
import DashboardOverview from "./pages/Dashboards/Overview";
import Revenue from "./pages/Dashboards/Revenue";
import Funnel from "./pages/Dashboards/Funnel";
import ClientBase from "./pages/Dashboards/ClientBase";
import Trends from "./pages/Dashboards/Trends";

// Dashboard pages

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
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                  <DashboardOverview />
                </ProtectedRoute>
              }
            />

            {/* Dashboard — specific sections */}
            <Route
              path="/dashboard/revenue"
              element={
                <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                  <Revenue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/funnel"
              element={
                <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                  <Funnel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/clients"
              element={
                <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                  <ClientBase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/vehicles"
              element={
                <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                  <Trends />
                </ProtectedRoute>
              }
            />

            {/* Other pages */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["Administrateur BI"]}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data"
              element={
                <ProtectedRoute allowedRoles={["Administrateur BI"]}>
                  <DataManagement />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
      </FilterProvider>
    </AuthProvider>
  );
}
