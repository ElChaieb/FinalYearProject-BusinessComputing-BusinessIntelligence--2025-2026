import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ALL_ROLES = [
  "Administrateur BI",
  "Directeur Général",
  "Directeur Commercial",
  "Responsable d'Agence",
  "Commercial",
];

const navItems = [
  {
    label: "Dashboard",
    path:  "/dashboard",
    roles: ALL_ROLES,
  },
  {
    label: "Admin Panel",
    path:  "/admin",
    roles: ["Administrateur BI"],
  },
  {
    label: "Data Management",
    path:  "/data",
    roles: ["Administrateur BI"],
  },
  {
    label: "My Profile",
    path:  "/profile",
    roles: ALL_ROLES,
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const filtered = navItems.filter((item) => item.roles.includes(user?.role));

  return (
    <div className="h-screen w-64 bg-gray-900 text-white flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">BI App</h1>
        <p className="text-sm text-gray-400 mt-1">{user?.role}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filtered.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block px-4 py-2 rounded-lg transition text-sm ${
                isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <p className="text-sm text-gray-300 font-medium truncate">{user?.name}</p>
        <p className="text-xs text-gray-500 truncate mb-3">{user?.email}</p>
        <button
          onClick={logout}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
