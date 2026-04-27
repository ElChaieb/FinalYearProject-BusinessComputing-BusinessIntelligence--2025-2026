import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useFilter } from "../../context/FilterContext";
import DashboardLayout from "../../components/DashboardLayout";
import Section1 from "./GlobalDashboards/Section1";
import AgencyManagerDashboard from "./AgencyDashboard/AgencyManagerDashboard";
import CommercialDashboard from "./CommercialDashboard/CommercialDashboard";

const ROLE_MAP = {
  "Directeur Général":    "global",
  "Directeur Commercial": "global",
  "Administrateur BI":    "global",
  "Responsable d'Agence": "agency",
  "Commercial":           "commercial",
};

export default function RevenuePage() {
  const { user } = useAuth();
  const role = ROLE_MAP[user?.role] ?? "global";

  if (role === "agency")     return <AgencyManagerDashboard activeSection="revenue" />;
  if (role === "commercial") return <CommercialDashboard     activeSection="revenue" />;
  return <GlobalRevenuePage />;
}

function GlobalRevenuePage() {
  const { filter } = useFilter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab]   = useState("monthly");
  const [breadcrumb, setBreadcrumb] = useState(["Revenue"]);

  return (
    <DashboardLayout
      title="Revenue"
      subtitle="Sales revenue analytics"
      breadcrumb={breadcrumb}
    >
      <Section1
        filter={filter}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onBreadcrumbChange={setBreadcrumb}
        standalone
      />
    </DashboardLayout>
  );
}
