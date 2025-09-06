import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute() {
  const { isAuthenticated, status } = useAuth();
  const loc = useLocation();

  if (status === "idle" || status === "loading") return <div>Carregando...</div>;
  if (!isAuthenticated) return <Navigate to="/Login" state={{ from: loc }} replace />;

  return <Outlet />;
}
