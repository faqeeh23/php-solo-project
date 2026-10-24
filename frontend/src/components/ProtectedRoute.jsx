import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../services/api";

export default function ProtectedRoute({ children, allowedRole }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const data = await apiRequest("me");

        if (active) {
          setUser(data.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p>Checking authentication...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    const routes = {
      patient: "/patient",
      doctor: "/doctor",
      admin: "/admin"
    };

    return (
      <Navigate
        to={routes[user.role] || "/login"}
        replace
      />
    );
  }

  return children;
}
