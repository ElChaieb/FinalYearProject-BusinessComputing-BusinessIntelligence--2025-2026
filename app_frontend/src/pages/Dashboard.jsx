// pages/Dashboard.jsx
// Routes to the correct dashboard based on user role.
// DG and DC share the same data access but different default views.

import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import DashboardGlobal from "./dashboards/DashboardGlobal";
import DashboardAgence from "./dashboards/DashboardAgence";
import DashboardCommercial from "./dashboards/DashboardCommercial";

const ROLE_MAP = {
  "Directeur Général":       DashboardGlobal,
  "Directeur Commercial":    DashboardGlobal,   // same access, same component
  "Responsable d'Agence":    DashboardAgence,
  "Commercial":              DashboardCommercial,
  "Administrateur BI":       DashboardGlobal,   // admin sees global view
};

export default function Dashboard() {
  const { user } = useAuth();
  const DashboardComponent = ROLE_MAP[user?.role] || DashboardGlobal;

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 min-h-screen bg-[#0f1117]">
        <Navbar title="Dashboard" />
        <div className="pt-16">
          <DashboardComponent />
        </div>
      </div>
    </div>
  );
}
