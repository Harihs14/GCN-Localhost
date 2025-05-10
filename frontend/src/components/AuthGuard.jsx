import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const AuthGuard = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const userId = localStorage.getItem("userId");
    if (userId) {
      setAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Show loading state
  if (loading) {
    return <div>Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  // Render children if authenticated
  return <>{children}</>;
};

export const logout = () => {
  localStorage.removeItem("userId");
  localStorage.removeItem("username");
  localStorage.removeItem("token");
  window.location.href = "/";
};

export default AuthGuard;
