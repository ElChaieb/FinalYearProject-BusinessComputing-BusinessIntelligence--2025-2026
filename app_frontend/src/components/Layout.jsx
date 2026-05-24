// components/Layout.jsx
// Wraps any page with the fixed Sidebar + a content area that shifts with it.
import Sidebar from "./Sidebar";
import { useSidebar } from "../context/SidebarContext";

export const SIDEBAR_OPEN_W = 220;
export const SIDEBAR_CLOSED_W = 64;

// Layout wrapper that positions the fixed Sidebar and content area
export default function Layout({ children, style }) {
  const { isOpen } = useSidebar();
  const sidebarW = isOpen ? SIDEBAR_OPEN_W : SIDEBAR_CLOSED_W;

  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      {/*
        Sidebar is position:fixed so it's out of normal flow.
        Without an explicit width, this div would fill 100vw, then
        marginLeft would push it further right → horizontal scroll.
        Fix: width = viewport - sidebar so the content always fits.
      */}
      <div
        style={{
          marginLeft: sidebarW,
          width: `calc(100vw - ${sidebarW}px)`,
          minWidth: 0,
          minHeight: "100vh",
          overflowX: "hidden",
          boxSizing: "border-box",
          transition:
            "margin-left 0.22s cubic-bezier(.4,0,.2,1), width 0.22s cubic-bezier(.4,0,.2,1)",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
