// components/Sidebar.jsx
// Upgraded sidebar with dashboard section sub-navigation
// Preserves existing role-based filtering + adds Revenue/Funnel/Vehicles/Clients links

import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ALL_ROLES = [
  "Administrateur BI",
  "Directeur Général",
  "Directeur Commercial",
  "Responsable d'Agence",
  "Commercial",
];

const DASHBOARD_ROLES = [
  "Administrateur BI",
  "Directeur Général",
  "Directeur Commercial",
  "Responsable d'Agence",
  "Commercial",
];

// Dashboard sub-sections — visible to all dashboard users
const DASHBOARD_SECTIONS = [
  { label: "Overview",  path: "/dashboard",          icon: GridIcon  },
  { label: "Revenue",   path: "/dashboard/revenue",  icon: RevenueIcon },
  { label: "Funnel",    path: "/dashboard/funnel",   icon: FunnelIcon },
  { label: "Vehicles",  path: "/dashboard/vehicles", icon: VehicleIcon },
  { label: "Clients",   path: "/dashboard/clients",  icon: ClientIcon },
];

const TOP_NAV = [
  { label: "Admin Panel",      path: "/admin",   roles: ["Administrateur BI"] },
  { label: "Data Management",  path: "/data",    roles: ["Administrateur BI"] },
  { label: "My Profile",       path: "/profile", roles: ALL_ROLES },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isDashboardSection = location.pathname.startsWith("/dashboard");
  const filteredTop = TOP_NAV.filter((item) => item.roles.includes(user?.role));

  // Role initials for avatar
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        background: "#0d1117",
        borderRight: "1px solid #1e2530",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 40,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #1e2530" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>B</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", letterSpacing: "-0.01em" }}>BI App</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{user?.role}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 12px", overflowY: "auto" }}>

        {/* Dashboard section */}
        {DASHBOARD_ROLES.includes(user?.role) && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: "#334155",
              letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "4px 8px 8px",
            }}>
              Dashboard
            </div>
            {DASHBOARD_SECTIONS.map(({ label, path, icon: Icon }) => (
              <SidebarLink key={path} to={path} label={label} icon={<Icon />} exact={path === "/dashboard"} />
            ))}
          </div>
        )}

        {/* Divider */}
        {filteredTop.length > 0 && (
          <div style={{ height: 1, background: "#1e2530", margin: "8px 0 12px" }} />
        )}

        {/* Other nav */}
        {filteredTop.map(({ label, path }) => (
          <SidebarLink key={path} to={path} label={label} />
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: "12px 12px 16px", borderTop: "1px solid #1e2530" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#1e3a5f",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 600, color: "#60a5fa", flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            width: "100%", padding: "7px 12px",
            background: "transparent",
            border: "1px solid #2d3748",
            borderRadius: 8, cursor: "pointer",
            fontSize: 12, fontWeight: 500,
            color: "#94a3b8",
            transition: "all 0.15s",
            textAlign: "center",
          }}
          onMouseEnter={e => { e.target.style.borderColor = "#ef4444"; e.target.style.color = "#ef4444"; e.target.style.background = "#1a0a0a"; }}
          onMouseLeave={e => { e.target.style.borderColor = "#2d3748"; e.target.style.color = "#94a3b8"; e.target.style.background = "transparent"; }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ to, label, icon, exact = false }) {
  return (
    <NavLink
      to={to}
      end={exact}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        borderRadius: 7,
        marginBottom: 2,
        fontSize: 13,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? "#f1f5f9" : "#64748b",
        background: isActive ? "#1e2d3d" : "transparent",
        textDecoration: "none",
        transition: "all 0.12s",
        borderLeft: isActive ? "2px solid #3b82f6" : "2px solid transparent",
      })}
      onMouseEnter={e => {
        if (!e.currentTarget.classList.contains("active")) {
          e.currentTarget.style.color = "#cbd5e1";
          e.currentTarget.style.background = "#141c26";
        }
      }}
      onMouseLeave={e => {
        // NavLink handles active state via style prop, just reset hover
        const link = e.currentTarget;
        if (link.getAttribute("aria-current") !== "page") {
          link.style.color = "";
          link.style.background = "";
        }
      }}
    >
      {icon && <span style={{ opacity: 0.7, flexShrink: 0, display: "flex" }}>{icon}</span>}
      {label}
    </NavLink>
  );
}

// ─── Icons (simple SVG, 16×16) ────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/>
    </svg>
  );
}

function RevenueIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1 12 L4 8 L7 9.5 L11 5 L15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 15 H15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".4"/>
    </svg>
  );
}

function FunnelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1 2h14l-5 5v6l-4-2V7L1 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function VehicleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="6" width="14" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
      <path d="M3 6 L5 3 H11 L13 6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="4.5" cy="12.5" r="1.5" fill="currentColor"/>
      <circle cx="11.5" cy="12.5" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function ClientIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
      <path d="M1 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M11 7c1.1 0 2 .9 2 2M13 14c0-1.66-.9-3.1-2.2-3.87" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
