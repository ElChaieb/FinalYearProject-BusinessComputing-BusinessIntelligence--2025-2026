// pages/Dashboards/AgencyDashboard/AgencyManagerDashboard.jsx
//
// Full page for Responsable d'Agence.
// Agency name comes from JWT (user.agency_name) — passed as prop so
// AgencyPanel header can show it; the actual data scoping is server-side.

import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import Sidebar from "../../../components/Sidebar";
import {
  DateRangePicker,
  DEFAULT_PRESETS,
} from "../../../components/DateRangePicker";
import AgencyPanel from "../../panels/AgencyPanel";

export default function AgencyManagerDashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState(undefined);

  const filter =
    range?.from && range?.to
      ? {
          from: range.from.toISOString().split("T")[0],
          to: range.to.toISOString().split("T")[0],
        }
      : undefined;

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 min-h-screen bg-[#0f1117] p-8 text-white">
        <header className="fixed top-0 left-64 right-0 h-16 bg-white/95 border-b border-gray-200 flex items-center px-6 z-10">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              Agency Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              {user?.agency_name} — Agency Manager
            </p>
          </div>
          <div className="ml-auto w-80 text-black">
            <DateRangePicker
              value={range}
              onChange={setRange}
              presets={DEFAULT_PRESETS}
              className="w-full"
            />
          </div>
        </header>
        <main className="pt-24">
          <AgencyPanel agencyName={user?.agency_name} filter={filter} />
        </main>
      </div>
    </div>
  );
}
