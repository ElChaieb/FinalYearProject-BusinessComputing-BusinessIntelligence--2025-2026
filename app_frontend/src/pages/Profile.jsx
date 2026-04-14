// pages/Profile.jsx  — US-04: view and update profile information
// Accessible from the sidebar by all roles.

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, login } = useAuth();

  // Profile update (US-04)
  const [name, setName]         = useState(user?.name ?? "");
  const [profileMsg, setProfileMsg] = useState({ text: "", type: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change (US-03 — also accessible here)
  const [pwForm, setPwForm]   = useState({ old_password: "", new_password: "", confirm: "" });
  const [pwMsg, setPwMsg]     = useState({ text: "", type: "" });
  const [savingPw, setSavingPw] = useState(false);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg({ text: "", type: "" });
    try {
      await api.put("/auth/profile", { name });
      // Refresh /me so context stays in sync
      const res = await api.get("/me");
      login(res.data, localStorage.getItem("token"));
      setProfileMsg({ text: "Profile updated successfully.", type: "success" });
    } catch (err) {
      setProfileMsg({ text: err.response?.data?.detail || "Update failed", type: "error" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ text: "New passwords do not match.", type: "error" });
      return;
    }
    setSavingPw(true);
    setPwMsg({ text: "", type: "" });
    try {
      await api.put("/auth/change-password", {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      });
      setPwMsg({ text: "Password changed successfully.", type: "success" });
      setPwForm({ old_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setPwMsg({ text: err.response?.data?.detail || "Password change failed", type: "error" });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 min-h-screen bg-gray-50">
        <Navbar title="My Profile" />
        <div className="pt-20 p-6 max-w-xl space-y-6">

          {/* Profile info card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-1">Profile Information</h2>
            <p className="text-sm text-gray-400 mb-5">Update your display name.</p>

            {profileMsg.text && (
              <div className={`px-4 py-2 rounded-lg mb-4 text-sm ${
                profileMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}>
                {profileMsg.text}
              </div>
            )}

            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="text-sm text-gray-700 font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Role</p>
                <p className="text-sm text-gray-700 font-medium">{user?.role}</p>
              </div>
              {user?.agency_name && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Agency</p>
                  <p className="text-sm text-gray-700 font-medium">{user.agency_name}</p>
                </div>
              )}
              {user?.last_login && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Login</p>
                  <p className="text-sm text-gray-700">
                    {new Date(user.last_login).toLocaleString("fr-TN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              )}
            </div>

            {/* Editable name */}
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile || name === user?.name}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Change password card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-1">Change Password</h2>
            <p className="text-sm text-gray-400 mb-5">Choose a strong password.</p>

            {pwMsg.text && (
              <div className={`px-4 py-2 rounded-lg mb-4 text-sm ${
                pwMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}>
                {pwMsg.text}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              {[
                { label: "Current Password", key: "old_password" },
                { label: "New Password",     key: "new_password" },
                { label: "Confirm New Password", key: "confirm"  },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="password"
                    value={pwForm[key]}
                    onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={savingPw}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
              >
                {savingPw ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
