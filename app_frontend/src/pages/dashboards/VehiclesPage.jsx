// pages/dashboards/VehiclesPage.jsx
import { useState } from "react";
import { useFilter } from "../../context/FilterContext";
import DashboardLayout from "../../components/DashboardLayout";
import Section3 from "./GlobalDashboards/Section3";

export default function VehiclesPage() {
  const { filter } = useFilter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab]   = useState("monthly");
  const [breadcrumb, setBreadcrumb] = useState(["Vehicles"]);

  return (
    <DashboardLayout
      title="Vehicle Trends"
      subtitle="Category, brand & model performance"
      breadcrumb={breadcrumb}
    >
      <Section3
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
