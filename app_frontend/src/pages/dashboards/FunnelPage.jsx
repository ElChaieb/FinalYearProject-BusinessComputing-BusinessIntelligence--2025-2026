// pages/dashboards/FunnelPage.jsx
import { useState } from "react";
import { useFilter } from "../../context/FilterContext";
import DashboardLayout from "../../components/DashboardLayout";
import Section2 from "./GlobalDashboards/Section2";

export default function FunnelPage() {
  return <GlobalFunnelPage />;
}

function GlobalFunnelPage() {
  const { filter } = useFilter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab]   = useState("monthly");
  const [breadcrumb, setBreadcrumb] = useState(["Funnel"]);

  return (
    <DashboardLayout
      title="Conversion Funnel"
      subtitle="Opportunities → Quotes → Sales"
      breadcrumb={breadcrumb}
    >
      <Section2
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
