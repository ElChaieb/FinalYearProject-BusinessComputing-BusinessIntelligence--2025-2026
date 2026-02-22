import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const dummyLine = [
  { month: "Jan", sales: 4000 },
  { month: "Feb", sales: 3000 },
  { month: "Mar", sales: 5000 },
  { month: "Apr", sales: 4800 },
  { month: "May", sales: 7000 },
  { month: "Jun", sales: 6500 },
];

const dummyBar = [
  { agency: "Alger", revenue: 12000 },
  { agency: "Oran", revenue: 8000 },
  { agency: "Annaba", revenue: 6500 },
  { agency: "Tizi", revenue: 4300 },
];

export default function Dashboard() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 min-h-screen bg-gray-50">
        <Navbar title="Dashboard" />
        <div className="pt-20 p-6 space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Sales", value: "1,240,000 DA" },
              { label: "Active Clients", value: "342" },
              { label: "Agencies", value: "12" },
              { label: "Commercials", value: "48" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">Monthly Sales</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dummyLine}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">Revenue by Agency</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dummyBar}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agency" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}