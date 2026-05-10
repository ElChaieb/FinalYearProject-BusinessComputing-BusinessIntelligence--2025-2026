// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import DataManagement from "./pages/DataManagement";
import Profile from "./pages/Profile";

// Directors dashboard pages
import DirectorRevenue from "./pages/Directors/DirectorRevenue";
import DirectorFunnel from "./pages/Directors/DirectorFunnel";
import DirectorTrends from "./pages/Directors/DirectorTrends";

// Agency dashboard pages
import AgencyRevenue from "./pages/Agency/AgencyRevenue";
import AgencyFunnel from "./pages/Agency/AgencyFunnel";
import AgencyTrends from "./pages/Agency/AgencyTrends";

// Commercial dashboard pages
import CommercialRevenue from "./pages/Commercial/CommercialRevenue";

const DIRECTOR_ROLES   = ["Administrateur BI", "General Director", "Commercial Director"];
const AGENCY_ROLES     = ["Agency Manager"];
const COMMERCIAL_ROLES = ["Commercial"];

export default function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <BrowserRouter>
          <Routes>

            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Directors dashboard — Admin + both Directors */}
            <Route path="/directors/revenue" element={<ProtectedRoute allowedRoles={DIRECTOR_ROLES}><DirectorRevenue /></ProtectedRoute>} />
            <Route path="/directors/funnel"  element={<ProtectedRoute allowedRoles={DIRECTOR_ROLES}><DirectorFunnel /></ProtectedRoute>} />
            <Route path="/directors/trends"  element={<ProtectedRoute allowedRoles={DIRECTOR_ROLES}><DirectorTrends /></ProtectedRoute>} />

            {/* Agency dashboard — Agency Manager */}
            <Route path="/agency/revenue" element={<ProtectedRoute allowedRoles={AGENCY_ROLES}><AgencyRevenue /></ProtectedRoute>} />
            <Route path="/agency/funnel"  element={<ProtectedRoute allowedRoles={AGENCY_ROLES}><AgencyFunnel /></ProtectedRoute>} />
            <Route path="/agency/trends"  element={<ProtectedRoute allowedRoles={AGENCY_ROLES}><AgencyTrends /></ProtectedRoute>} />

            {/* Commercial dashboard — Commercial */}
            <Route path="/commercial/revenue" element={<ProtectedRoute allowedRoles={COMMERCIAL_ROLES}><CommercialRevenue /></ProtectedRoute>} />

            {/* Admin-only */}
            <Route path="/admin"   element={<ProtectedRoute allowedRoles={["Administrateur BI"]}><Admin /></ProtectedRoute>} />
            <Route path="/data"    element={<ProtectedRoute allowedRoles={["Administrateur BI"]}><DataManagement /></ProtectedRoute>} />

            {/* Profile */}
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
      </SidebarProvider>
    </AuthProvider>
  );
}
