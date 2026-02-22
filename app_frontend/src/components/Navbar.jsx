import { useAuth } from "../context/AuthContext";

export default function Navbar({ title }) {
  const { user } = useAuth();

  return (
    <div className="h-16 bg-white border-b flex items-center justify-between px-6 fixed top-0 left-64 right-0 z-10">
      <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
      <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
    </div>
  );
}