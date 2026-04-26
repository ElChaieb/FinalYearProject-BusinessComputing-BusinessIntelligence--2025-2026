// pages/Admin.jsx
// Covers: US-05 (create user), US-06 (enable/disable), US-07 (user list), US-08 (reset password)

import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../api/axios";

const ROLES = [
  "General Director",
  "Commercial Director",
  "Agency Manager",
  "Commercial",
];

const AGENCIES = ["Geely Sousse", "Geely Sfax", "Geely Gabes", "Geely Ben Arous"];

// Roles that must be tied to an agency
const AGENCY_ROLES = ["Agency Manager", "Commercial"];

function Badge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-gray-400"}`} />
      {active ? "Active" : "Disabled"}
    </span>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("users");

  // Create user form state
  const [form, setForm]       = useState({ name: "", email: "", role: ROLES[0], agency_name: "" });
  const [formMsg, setFormMsg] = useState({ text: "", type: "" });
  const [creating, setCreating] = useState(false);

  // User list state
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Confirmation modal
  const [confirm, setConfirm] = useState(null); // { type: "toggle"|"reset", user }

  const needsAgency = AGENCY_ROLES.includes(form.role);

  // ── Load users ────────────────────────────────────────────
  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [tab]);

  // ── Create user (US-05) ──────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setFormMsg({ text: "", type: "" });
    try {
      await api.post("/auth/users/create", form);
      setFormMsg({ text: `✓ ${form.name} created. Credentials sent to ${form.email}.`, type: "success" });
      setForm({ name: "", email: "", role: ROLES[0], agency_name: "" });
      if (tab === "users") loadUsers();
    } catch (err) {
      setFormMsg({ text: err.response?.data?.detail || "Something went wrong", type: "error" });
    } finally {
      setCreating(false);
    }
  }

  // ── Enable/disable (US-06) ───────────────────────────────
  async function handleToggle(user) {
    setConfirm(null);
    try {
      const res = await api.patch(`/auth/users/${user.id}/toggle`);
      setActionMsg(res.data.message);
      loadUsers();
    } catch (err) {
      setActionMsg(err.response?.data?.detail || "Action failed");
    }
    setTimeout(() => setActionMsg(""), 4000);
  }

  // ── Reset password (US-08) ───────────────────────────────
  async function handleReset(user) {
    setConfirm(null);
    try {
      const res = await api.post(`/auth/users/${user.id}/reset-password`);
      setActionMsg(res.data.message);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || "Reset failed");
    }
    setTimeout(() => setActionMsg(""), 4000);
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 min-h-screen bg-gray-50">
        <Navbar title="Admin Panel" />
        <div className="pt-20 p-6 max-w-5xl">

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {[{ id: "users", label: "User List" }, { id: "create", label: "Create User" }].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                  tab === t.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── User List (US-06, US-07, US-08) ──────────────── */}
          {tab === "users" && (
            <div>
              {actionMsg && (
                <div className="mb-4 bg-blue-50 text-blue-700 text-sm px-4 py-2 rounded-lg">
                  {actionMsg}
                </div>
              )}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-700">All Users</h2>
                  <button onClick={loadUsers} className="text-xs text-blue-600 hover:underline">
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        {["Name", "Email", "Role", "Agency", "Status", "Last Login", "Actions"].map((h) => (
                          <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                          <td className="px-4 py-3 text-gray-500">{u.email}</td>
                          <td className="px-4 py-3 text-gray-600">{u.role}</td>
                          <td className="px-4 py-3 text-gray-500">{u.agency_name ?? "—"}</td>
                          <td className="px-4 py-3"><Badge active={u.is_active} /></td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {u.last_login
                              ? new Date(u.last_login).toLocaleString("fr-TN", { dateStyle: "short", timeStyle: "short" })
                              : "Never"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {/* US-06: toggle enable/disable */}
                              <button
                                onClick={() => setConfirm({ type: "toggle", user: u })}
                                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                                  u.is_active
                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                    : "bg-green-50 text-green-600 hover:bg-green-100"
                                }`}
                              >
                                {u.is_active ? "Disable" : "Enable"}
                              </button>
                              {/* US-08: reset password */}
                              <button
                                onClick={() => setConfirm({ type: "reset", user: u })}
                                className="text-xs px-2.5 py-1 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                              >
                                Reset PW
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Create User (US-05) ──────────────────────────── */}
          {tab === "create" && (
            <div className="bg-white rounded-2xl shadow-sm p-6 max-w-lg">
              <h2 className="text-lg font-semibold text-gray-700 mb-5">Create New User</h2>

              {formMsg.text && (
                <div className={`px-4 py-2 rounded-lg mb-4 text-sm ${
                  formMsg.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}>
                  {formMsg.text}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value, agency_name: "" })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Show agency picker only for roles that require it */}
                {needsAgency && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agency <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.agency_name}
                      onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    >
                      <option value="">— Select agency —</option>
                      {AGENCIES.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      This user will only see data from this agency.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creating || (needsAgency && !form.agency_name)}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium text-sm transition"
                >
                  {creating ? "Creating..." : "Create User & Send Credentials"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-800 mb-2">
              {confirm.type === "toggle"
                ? `${confirm.user.is_active ? "Disable" : "Enable"} ${confirm.user.name}?`
                : `Reset password for ${confirm.user.name}?`}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {confirm.type === "toggle"
                ? confirm.user.is_active
                  ? "This user will no longer be able to log in."
                  : "This user will be able to log in again."
                : "A new password will be generated and sent to their email address."}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  confirm.type === "toggle"
                    ? handleToggle(confirm.user)
                    : handleReset(confirm.user)
                }
                className={`px-4 py-2 text-sm text-white rounded-lg transition ${
                  confirm.type === "toggle" && confirm.user.is_active
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
