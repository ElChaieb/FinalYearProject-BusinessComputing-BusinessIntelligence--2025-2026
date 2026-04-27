// pages/dashboards/ClientsPage.jsx
import { useState } from "react";
import { useFilter } from "../../context/FilterContext";
import DashboardLayout from "../../components/DashboardLayout";
import Section4 from "./GlobalDashboards/Section4";

export default function ClientsPage() {
  const { filter } = useFilter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab]   = useState("monthly");
  const [breadcrumb, setBreadcrumb] = useState(["Clients"]);

  return (
    <DashboardLayout
      title="Clients"
      subtitle="Customer segmentation & geography"
      breadcrumb={breadcrumb}
    >
      <Section4
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
