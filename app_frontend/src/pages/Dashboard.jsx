// pages/Dashboard.jsx — Overview landing page
// Shows Level 0 KPI pulse cards for all 4 sections
// Routes to role-specific dashboards for Agency Manager and Commercial

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFilter } from "../context/FilterContext";
import DashboardLayout from "../components/DashboardLayout";
import {
  useGlobalSection1Kpis,
  useGlobalSection2Kpis,
  useGlobalSection3Kpis,
  useGlobalSection4Kpis,
  useAgencyKpis,
  useMeKpis,
} from "../hooks/useDashboard";

// Role resolution
const ROLE_MAP = {
  "Directeur Général":    "global",
  "Directeur Commercial": "global",
  "Administrateur BI":    "global",
  "Responsable d'Agence": "agency",
  "Commercial":           "commercial",
};

const fmt = (n) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)} M TND`
    : n >= 1_000
    ? `${Math.round(n / 1_000)} K TND`
    : `${n} TND`;

const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "0%");

export default function Dashboard() {
  const { user } = useAuth();
  const role = ROLE_MAP[user?.role] ?? "global";

  if (role === "agency")     return <AgencyOverview />;
  if (role === "commercial") return <CommercialOverview />;
  return <GlobalOverview />;
}

// ─── Global Overview ──────────────────────────────────────────────────────────

function GlobalOverview() {
  const { filter } = useFilter();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: s1, loading: l1 } = useGlobalSection1Kpis(filter);
  const { data: s2, loading: l2 } = useGlobalSection2Kpis(filter);
  const { data: s3, loading: l3 } = useGlobalSection3Kpis(filter);
  const { data: s4, loading: l4 } = useGlobalSection4Kpis(filter);

  const sections = [
    {
      key: "revenue",
      label: "Revenue",
      path: "/dashboard/revenue",
      color: "#0078d4",
      icon: "💰",
      loading: l1,
      kpis: s1 ? [
        { label: "Total Revenue",  value: fmt(s1.total_revenue) },
        { label: "Sales Count",    value: s1.sales_count },
        { label: "Avg Sale Value", value: fmt(s1.avg_sale_value) },
      ] : [],
    },
    {
      key: "funnel",
      label: "Conversion Funnel",
      path: "/dashboard/funnel",
      color: "#7c3aed",
      icon: "🔄",
      loading: l2,
      kpis: s2 ? [
        { label: "Opportunities",   value: s2.total_opportunities },
        { label: "Quotes",          value: s2.total_quotes },
        { label: "Sales",           value: s2.total_sales },
        { label: "End-to-End Rate", value: pct(s2.total_sales, s2.total_opportunities) },
      ] : [],
    },
    {
      key: "vehicles",
      label: "Vehicles",
      path: "/dashboard/vehicles",
      color: "#06b6d4",
      icon: "🚗",
      loading: l3,
      kpis: s3 ? [
        { label: "Top Category",    value: s3.most_sold_category ?? "—" },
        { label: "Top Count",       value: s3.most_sold_count },
        { label: "Avg Cat. Sales",  value: s3.avg_category_sales },
      ] : [],
    },
    {
      key: "clients",
      label: "Clients",
      path: "/dashboard/clients",
      color: "#107c10",
      icon: "👥",
      loading: l4,
      kpis: s4 ? [
        { label: "Total Clients",   value: s4.total_clients },
        { label: "Top Governorate", value: s4.highest_state ?? "—" },
        { label: "Top Count",       value: s4.highest_count },
      ] : [],
    },
  ];

  return (
    <DashboardLayout
      title="Overview"
      subtitle={`Welcome back, ${user?.name}`}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {sections.map((section) => (
          <SectionPulseCard
            key={section.key}
            section={section}
            onClick={() => navigate(section.path)}
          />
        ))}
      </div>

      {/* Quick nav hint */}
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#a19f9d" }}>
          Click any section to drill down — or use the sidebar to navigate directly
        </p>
      </div>
    </DashboardLayout>
  );
}

// ─── Agency Overview ──────────────────────────────────────────────────────────

function AgencyOverview() {
  const { filter } = useFilter();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: kpis, loading } = useAgencyKpis(filter);

  const sections = [
    {
      key: "revenue", label: "Revenue", path: "/dashboard/revenue",
      color: "#0078d4", icon: "💰", loading,
      kpis: kpis ? [
        { label: "Revenue",    value: fmt(kpis.revenue) },
        { label: "Sales",      value: kpis.sales },
      ] : [],
    },
    {
      key: "funnel", label: "Conversion Funnel", path: "/dashboard/funnel",
      color: "#7c3aed", icon: "🔄", loading,
      kpis: kpis ? [
        { label: "Opportunities", value: kpis.opportunities },
        { label: "Quotes",        value: kpis.quotes },
        { label: "OQ Rate",       value: kpis.convOQ },
        { label: "QS Rate",       value: kpis.convQS },
      ] : [],
    },
    {
      key: "vehicles", label: "Vehicles", path: "/dashboard/vehicles",
      color: "#06b6d4", icon: "🚗", loading: false, kpis: [],
    },
    {
      key: "clients", label: "Clients", path: "/dashboard/clients",
      color: "#107c10", icon: "👥", loading: false, kpis: [],
    },
  ];

  return (
    <DashboardLayout
      title="Agency Overview"
      subtitle={user?.agency_name}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {sections.map((section) => (
          <SectionPulseCard key={section.key} section={section} onClick={() => navigate(section.path)} />
        ))}
      </div>
    </DashboardLayout>
  );
}

// ─── Commercial Overview ──────────────────────────────────────────────────────

function CommercialOverview() {
  const { filter } = useFilter();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: kpis, loading } = useMeKpis(filter);

  const sections = [
    {
      key: "revenue", label: "My Revenue", path: "/dashboard/revenue",
      color: "#0078d4", icon: "💰", loading,
      kpis: kpis ? [
        { label: "Revenue", value: fmt(kpis.revenue) },
        { label: "Sales",   value: kpis.sales },
      ] : [],
    },
    {
      key: "funnel", label: "My Pipeline", path: "/dashboard/funnel",
      color: "#7c3aed", icon: "🔄", loading,
      kpis: kpis ? [
        { label: "Opportunities", value: kpis.opportunities },
        { label: "Quotes",        value: kpis.quotes },
        { label: "Conv. Rate",    value: kpis.convQS },
      ] : [],
    },
    {
      key: "vehicles", label: "My Vehicles", path: "/dashboard/vehicles",
      color: "#06b6d4", icon: "🚗", loading: false, kpis: [],
    },
    {
      key: "clients", label: "My Clients", path: "/dashboard/clients",
      color: "#107c10", icon: "👥", loading: false, kpis: [],
    },
  ];

  return (
    <DashboardLayout
      title="My Dashboard"
      subtitle={user?.name}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {sections.map((section) => (
          <SectionPulseCard key={section.key} section={section} onClick={() => navigate(section.path)} />
        ))}
      </div>
    </DashboardLayout>
  );
}

// ─── Section Pulse Card ───────────────────────────────────────────────────────

function SectionPulseCard({ section, onClick }) {
  const { label, color, icon, loading, kpis } = section;

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: `1px solid #edebe9`,
        borderTop: `3px solid ${color}`,
        borderRadius: 4,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
        boxShadow: "0 1px 3px rgba(0,0,0,.07)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,.12)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderTopColor = color;
        e.currentTarget.style.borderRightColor = "#edebe9";
        e.currentTarget.style.borderBottomColor = "#edebe9";
        e.currentTarget.style.borderLeftColor = "#edebe9";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.07)";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.4 }}>
          <path d="M3 7h8M8 4l3 3-3 3" stroke="#605e5c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* KPI grid */}
      {loading ? (
        <div style={{ display: "flex", gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ flex: 1, height: 48, background: "#f3f2f1", borderRadius: 4, animation: "pulse 1.8s ease-in-out infinite" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {kpis.length === 0 ? (
            <span style={{ fontSize: 12, color: "#a19f9d" }}>Click to view details</span>
          ) : kpis.map((kpi) => (
            <div key={kpi.label} style={{ flex: "1 1 80px", minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#a19f9d", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#201f1e", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
