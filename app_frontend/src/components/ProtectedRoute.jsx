import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Route wrapper that enforces authentication and optional role checks
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}
