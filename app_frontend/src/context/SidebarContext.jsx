// Sidebar open/close state and toggle helper provided to the app
import { createContext, useContext, useState } from "react";

const SidebarContext = createContext(null);

// Provide `isOpen` and `toggle()` to control the sidebar visibility
export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebar_open");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  // Toggle sidebar state and persist preference to localStorage
  function toggle() {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_open", String(next));
      } catch {}
      return next;
    });
  }

  return (
    <SidebarContext.Provider value={{ isOpen, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

// Hook to access sidebar state and toggle action
export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>");
  return ctx;
}
