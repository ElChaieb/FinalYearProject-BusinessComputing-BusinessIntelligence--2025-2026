// components/Layout.jsx
// Wraps any page with the fixed Sidebar + a content area that shifts with it.
import Sidebar from "./Sidebar";
import { useSidebar } from "../context/SidebarContext";

export const SIDEBAR_OPEN_W  = 220;
export const SIDEBAR_CLOSED_W = 64;

export default function Layout({ children, style }) {
  const { isOpen } = useSidebar();
  const marginLeft = isOpen ? SIDEBAR_OPEN_W : SIDEBAR_CLOSED_W;

  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <div
        style={{
          marginLeft,
          flex: 1,
          minHeight: "100vh",
          transition: "margin-left 0.22s cubic-bezier(.4,0,.2,1)",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
