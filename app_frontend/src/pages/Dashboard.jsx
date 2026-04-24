// Dashboard.jsx — routes to the correct dashboard based on user role
// Passes filter (date range) down to all sections

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import {
  DateRangePicker,
  DEFAULT_PRESETS,
} from "../components/DateRangePicker";
import Section1 from "../pages/Dashboards/GlobalDashboards/Section1";
import Section2 from "../pages/Dashboards/GlobalDashboards/Section2";
import Section3 from "../pages/Dashboards/GlobalDashboards/Section3";
import Section4 from "../pages/Dashboards/GlobalDashboards/Section4";
import AgencyManagerDashboard from "../pages/Dashboards/AgencyDashboard/AgencyManagerDashboard";
import CommercialDashboard from "../pages/Dashboards/CommercialDashboard/CommercialDashboard";

const ROLE_MAP = {
  "Directeur Général": "global",
  "Directeur Commercial": "global",
  "Administrateur BI": "global",
  "Responsable d'Agence": "agency",
  Commercial: "commercial",
};

export default function Dashboard() {
  const { user } = useAuth();
  const role = ROLE_MAP[user?.role] ?? "global";

  if (role === "agency") return <AgencyManagerDashboard />;
  if (role === "commercial") return <CommercialDashboard />;
  return <GlobalDashboard />;
}

function GlobalDashboard() {
  const [range, setRange] = useState(undefined);

  // Convert DateRangePicker value to { from, to } strings for hooks
  const filter =
    range?.from && range?.to
      ? {
          from: range.from.toISOString().split("T")[0],
          to: range.to.toISOString().split("T")[0],
        }
      : undefined;

  const [isExpandedS1, setIsExpandedS1] = useState(false);
  const [isExpandedS2, setIsExpandedS2] = useState(false);
  const [isExpandedS3, setIsExpandedS3] = useState(false);
  const [isExpandedS4, setIsExpandedS4] = useState(false);
  const [activeTabS1, setActiveTabS1] = useState("monthly");
  const [activeTabS2, setActiveTabS2] = useState("monthly");
  const [activeTabS3, setActiveTabS3] = useState("monthly");
  const [activeTabS4, setActiveTabS4] = useState("monthly");

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 min-h-screen bg-[#0f1117] p-8 text-white">
        <header className="fixed top-0 left-64 right-0 h-16 bg-white/95 border-b border-gray-200 flex items-center px-6 z-10">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
            <p className="text-sm text-gray-500">Manager — full access</p>
          </div>
          <div className="ml-auto w-80 text-black">
            <DateRangePicker
              value={range}
              onChange={setRange}
              presets={DEFAULT_PRESETS}
              className="w-full"
            />
          </div>
        </header>

        <main className="pt-24 space-y-8">
          <Section1
            filter={filter}
            isExpanded={isExpandedS1}
            setIsExpanded={setIsExpandedS1}
            activeTab={activeTabS1}
            setActiveTab={setActiveTabS1}
          />
          <Section2
            filter={filter}
            isExpanded={isExpandedS2}
            setIsExpanded={setIsExpandedS2}
            activeTab={activeTabS2}
            setActiveTab={setActiveTabS2}
          />
          <Section3
            filter={filter}
            isExpanded={isExpandedS3}
            setIsExpanded={setIsExpandedS3}
            activeTab={activeTabS3}
            setActiveTab={setActiveTabS3}
          />
          <Section4
            filter={filter}
            isExpanded={isExpandedS4}
            setIsExpanded={setIsExpandedS4}
            activeTab={activeTabS4}
            setActiveTab={setActiveTabS4}
          />
        </main>
      </div>
    </div>
  );
}
