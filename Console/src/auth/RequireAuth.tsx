import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { inspectionBypassEnabled } from "./session";

export function RequireAuth() {
  const { session } = useAuth();
  const location = useLocation();
  return session || inspectionBypassEnabled ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}
