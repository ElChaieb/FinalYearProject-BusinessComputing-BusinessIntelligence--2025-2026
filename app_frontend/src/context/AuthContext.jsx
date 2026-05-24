// AuthContext manages user sign-in state, persistence, and logout behavior
import { createContext, useContext, useState } from "react";

// Context providing auth state and actions to the app
const AuthContext = createContext();

// Provide `user`, `login(token)`, and `logout()` to descendants
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  // Persist token and user info, and set user state
  const login = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  // Clear stored credentials and reset user state
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to access auth context (user, login, logout)
export function useAuth() {
  return useContext(AuthContext);
}
