// components/Sidebar.jsx — Power BI light theme
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ALL_ROLES = [  "Administrateur BI",
  "General Director",
  "Commercial Director",
  "Agency Manager",
  "Commercial"];
const DASHBOARD_ROLES = [...ALL_ROLES];

const DASHBOARD_SECTIONS = [
  { label: "Overview",  path: "/dashboards/Overview",          icon: GridIcon  },
  { label: "Revenue",   path: "/Dashboards/Revenue",  icon: RevenueIcon },
  { label: "Funnel",    path: "/dashboard/Funnel",   icon: FunnelIcon },
  { label: "Vehicles",  path: "/dashboard/Trends", icon: VehicleIcon },
  { label: "Clients",   path: "/dashboard/ClientBase",  icon: ClientIcon },
];

const TOP_NAV = [
  { label: "Admin Panel",     path: "/admin",   roles: ["Administrateur BI"] },
  { label: "Data Management", path: "/data",    roles: ["Administrateur BI"] },
  { label: "My Profile",      path: "/profile", roles: ALL_ROLES },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const filteredTop = TOP_NAV.filter((item) => item.roles.includes(user?.role));

  const initials = (user?.name ?? "?")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside style={{
      width: 220, minHeight: "100vh",
      background: "#fff",
      borderRight: "1px solid #edebe9",
      display: "flex", flexDirection: "column",
      position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 40,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 16px", borderBottom: "1px solid #edebe9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 4,
            background: "#0078d4",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" fill="#fff" opacity="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1" fill="#fff" opacity=".7"/>
              <rect x="3" y="14" width="7" height="7" rx="1" fill="#fff" opacity=".7"/>
              <rect x="14" y="14" width="7" height="7" rx="1" fill="#fff" opacity=".4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#201f1e", letterSpacing: "-0.01em" }}>BI App</div>
            <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1 }}>{user?.role}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
        {DASHBOARD_ROLES.includes(user?.role) && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "#a19f9d",
              letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "4px 10px 8px",
            }}>
              Dashboard
            </div>
            {DASHBOARD_SECTIONS.map(({ label, path, icon: Icon }) => (
              <SidebarLink key={path} to={path} label={label} icon={<Icon />} exact={path === "/Dashboards"} />
            ))}
          </div>
        )}

        {filteredTop.length > 0 && (
          <div style={{ height: 1, background: "#edebe9", margin: "8px 0 12px" }} />
        )}

        {filteredTop.map(({ label, path }) => (
          <SidebarLink key={path} to={path} label={label} />
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: "12px 8px 16px", borderTop: "1px solid #edebe9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "0 4px" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#deecf9",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#0078d4", flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: "#a19f9d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            width: "100%", padding: "7px 12px",
            background: "transparent",
            border: "1px solid #edebe9",
            borderRadius: 4, cursor: "pointer",
            fontSize: 12, fontWeight: 500,
            color: "#605e5c",
            transition: "all 0.12s",
            textAlign: "center",
          }}
          onMouseEnter={e => { e.target.style.borderColor = "#d13438"; e.target.style.color = "#d13438"; e.target.style.background = "#fde7e9"; }}
          onMouseLeave={e => { e.target.style.borderColor = "#edebe9"; e.target.style.color = "#605e5c"; e.target.style.background = "transparent"; }}
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
        display: "flex", alignItems: "center", gap: 9,
        padding: "7px 10px",
        borderRadius: 4, marginBottom: 2,
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? "#0078d4" : "#605e5c",
        background: isActive ? "#deecf9" : "transparent",
        textDecoration: "none",
        transition: "all 0.1s",
        borderLeft: isActive ? "3px solid #0078d4" : "3px solid transparent",
      })}
      onMouseEnter={e => {
        if (e.currentTarget.getAttribute("aria-current") !== "page") {
          e.currentTarget.style.background = "#f3f2f1";
          e.currentTarget.style.color = "#201f1e";
        }
      }}
      onMouseLeave={e => {
        if (e.currentTarget.getAttribute("aria-current") !== "page") {
          e.currentTarget.style.background = "";
          e.currentTarget.style.color = "";
        }
      }}
    >
      {icon && <span style={{ opacity: 0.7, flexShrink: 0, display: "flex" }}>{icon}</span>}
      {label}
    </NavLink>
  );
}

// ─── Icons ────────────────────────────────────────────────────────
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
