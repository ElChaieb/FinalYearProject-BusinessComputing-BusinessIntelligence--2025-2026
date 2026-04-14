import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login          from "./pages/Login";
import Dashboard      from "./pages/Dashboard";
import Admin          from "./pages/Admin";
import DataManagement from "./pages/DataManagement";
import Profile        from "./pages/Profile";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

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
    </AuthProvider>
  );
}
