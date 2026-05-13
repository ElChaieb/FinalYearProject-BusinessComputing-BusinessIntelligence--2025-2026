// components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

const OPEN_W   = 220;
const CLOSED_W = 64;

const ALL_ROLES = [
  "Administrateur BI",
  "General Director",
  "Commercial Director",
  "Agency Manager",
  "Commercial",
];
const DIRECTOR_ROLES   = ["Administrateur BI", "General Director", "Commercial Director"];
const AGENCY_ROLES     = ["Agency Manager"];
const COMMERCIAL_ROLES = ["Commercial"];

const DASHBOARD_NAV = [
  { label: "Revenue", path: "/directors/revenue", icon: RevenueIcon, roles: DIRECTOR_ROLES },
  { label: "Funnel",  path: "/directors/funnel",  icon: FunnelIcon,  roles: DIRECTOR_ROLES },
  { label: "Trends",  path: "/directors/trends",  icon: TrendsIcon,  roles: DIRECTOR_ROLES },
  { label: "Revenue", path: "/agency/revenue",    icon: RevenueIcon, roles: AGENCY_ROLES },
  { label: "Funnel",  path: "/agency/funnel",     icon: FunnelIcon,  roles: AGENCY_ROLES },
  { label: "Trends",  path: "/agency/trends",     icon: TrendsIcon,  roles: AGENCY_ROLES },
  { label: "My Performance", path: "/commercial/revenue",icon: RevenueIcon, roles: COMMERCIAL_ROLES },
];

const TOP_NAV = [
  { label: "Admin Panel",     path: "/admin",   icon: AdminIcon,   roles: ["Administrateur BI"] },
  { label: "Data Management", path: "/data",    icon: DataIcon,    roles: ["Administrateur BI"] },
  { label: "My Profile",      path: "/profile", icon: ProfileIcon, roles: ALL_ROLES },
];

function getDashboardLabel(role) {
  if (DIRECTOR_ROLES.includes(role))   return "Directors Dashboard";
  if (AGENCY_ROLES.includes(role))     return "Agency Dashboard";
  if (COMMERCIAL_ROLES.includes(role)) return "My Dashboard";
  return "Dashboard";
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isOpen, toggle } = useSidebar();
  const role = user?.role;

  const dashboardLinks = DASHBOARD_NAV.filter((item) => item.roles.includes(role));
  const topLinks       = TOP_NAV.filter((item) => item.roles.includes(role));
  const initials = (user?.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside style={{
      width: isOpen ? OPEN_W : CLOSED_W,
      minHeight: "100vh",
      background: "#fff",
      borderRight: "1px solid #edebe9",
      display: "flex", flexDirection: "column",
      position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 40,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      transition: "width 0.22s cubic-bezier(.4,0,.2,1)",
      overflow: "hidden",
    }}>

      {/* Logo + toggle */}
      <div style={{
        padding: isOpen ? "18px 16px 16px" : "18px 0 16px",
        borderBottom: "1px solid #edebe9",
        display: "flex", alignItems: "center",
        justifyContent: isOpen ? "space-between" : "center",
        flexShrink: 0, gap: 8,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          overflow: "hidden", flex: isOpen ? 1 : 0,
          opacity: isOpen ? 1 : 0, transition: "opacity 0.15s",
          whiteSpace: "nowrap",
        }}>
          <LogoMark />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#201f1e", letterSpacing: "-0.01em" }}>BI App</div>
            <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1 }}>{role}</div>
          </div>
        </div>
        <button
          onClick={toggle}
          title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            width: 28, height: 28, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "1px solid #edebe9",
            borderRadius: 4, cursor: "pointer", color: "#605e5c",
            transition: "background 0.1s, border-color 0.1s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f3f2f1"; e.currentTarget.style.borderColor = "#c8c6c4"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#edebe9"; }}
        >
          <ChevronIcon flipped={!isOpen} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: isOpen ? "12px 8px" : "12px 4px", overflowY: "auto", overflowX: "hidden" }}>
        {dashboardLinks.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {isOpen && <SectionLabel>{getDashboardLabel(role)}</SectionLabel>}
            {dashboardLinks.map(({ label, path, icon: Icon }) => (
              <SidebarLink key={path} to={path} label={label} icon={<Icon />} isOpen={isOpen} />
            ))}
          </div>
        )}
        {topLinks.length > 0 && (
          <>
            <div style={{ height: 1, background: "#edebe9", margin: "8px 0 12px" }} />
            {isOpen && <SectionLabel>General</SectionLabel>}
            {topLinks.map(({ label, path, icon: Icon }) => (
              <SidebarLink key={path} to={path} label={label} icon={<Icon />} isOpen={isOpen} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div style={{ padding: isOpen ? "12px 8px 16px" : "12px 4px 16px", borderTop: "1px solid #edebe9", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: isOpen ? "flex-start" : "center",
          gap: isOpen ? 10 : 0, marginBottom: 10,
          padding: isOpen ? "0 4px" : 0,
        }}>
          <div title={!isOpen ? (user?.name ?? "") : undefined} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#deecf9",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#0078d4", flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{
            minWidth: 0, overflow: "hidden",
            opacity: isOpen ? 1 : 0, transition: "opacity 0.15s",
            whiteSpace: "nowrap",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#201f1e", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: "#a19f9d", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
          </div>
        </div>
        {isOpen ? (
          <button
            onClick={logout}
            style={{
              width: "100%", padding: "7px 12px", background: "transparent",
              border: "1px solid #edebe9", borderRadius: 4, cursor: "pointer",
              fontSize: 12, fontWeight: 500, color: "#605e5c",
              transition: "all 0.12s", textAlign: "center",
            }}
            onMouseEnter={e => { e.target.style.borderColor = "#d13438"; e.target.style.color = "#d13438"; e.target.style.background = "#fde7e9"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#edebe9"; e.target.style.color = "#605e5c"; e.target.style.background = "transparent"; }}
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={logout}
            title="Sign out"
            style={{
              width: "100%", padding: "7px 0", background: "transparent",
              border: "1px solid #edebe9", borderRadius: 4, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#605e5c", transition: "all 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#d13438"; e.currentTarget.style.color = "#d13438"; e.currentTarget.style.background = "#fde7e9"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#edebe9"; e.currentTarget.style.color = "#605e5c"; e.currentTarget.style.background = "transparent"; }}
          >
            <SignOutIcon />
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── Sub-components ────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "#a19f9d",
      letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "4px 10px 8px", whiteSpace: "nowrap",
    }}>
      {children}
    </div>
  );
}

function SidebarLink({ to, label, icon, isOpen }) {
  return (
    <NavLink
      to={to}
      title={!isOpen ? label : undefined}
      style={({ isActive }) => ({
        display: "flex", alignItems: "center",
        justifyContent: isOpen ? "flex-start" : "center",
        gap: 9,
        padding: isOpen ? "7px 10px" : "8px 0",
        borderRadius: 4, marginBottom: 2,
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? "#0078d4" : "#605e5c",
        background: isActive ? "#deecf9" : "transparent",
        textDecoration: "none",
        transition: "all 0.1s",
        borderLeft: isOpen ? (isActive ? "3px solid #0078d4" : "3px solid transparent") : "none",
        overflow: "hidden", whiteSpace: "nowrap",
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
      <span style={{
        opacity: isOpen ? 1 : 0,
        transition: "opacity 0.15s",
        display: "inline-block",
        overflow: "hidden",
      }}>
        {label}
      </span>
    </NavLink>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────
function LogoMark() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 4, background: "#0078d4",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" fill="#fff" opacity="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1" fill="#fff" opacity=".7"/>
        <rect x="3" y="14" width="7" height="7" rx="1" fill="#fff" opacity=".7"/>
        <rect x="14" y="14" width="7" height="7" rx="1" fill="#fff" opacity=".4"/>
      </svg>
    </div>
  );
}
function ChevronIcon({ flipped }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      style={{ transform: flipped ? "rotate(180deg)" : "none", transition: "transform 0.22s" }}>
      <path d="M10 4 L6 8 L10 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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
function TrendsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1 14 L5 9 L8 11 L12 6 L15 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="15" cy="4" r="1.5" fill="currentColor"/>
      <path d="M1 15 H15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".4"/>
    </svg>
  );
}
function AdminIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2" fill="currentColor" opacity=".5"/>
    </svg>
  );
}
function DataIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 4v4c0 1.1 2.24 2 5 2s5-.9 5-2V4" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 8v4c0 1.1 2.24 2 5 2s5-.9 5-2V8" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M6 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M10 11l3-3-3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
