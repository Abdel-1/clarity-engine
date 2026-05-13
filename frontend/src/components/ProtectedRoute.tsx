import { Navigate } from "react-router-dom";
import { isAuthenticated, isAdmin } from "../services/auth";

/**
 * ProtectedRoute — guards client-facing routes.
 * - Not logged in → /login
 * - Logged in as admin → /admin/clients  (admins have no client panel)
 * - Logged in as client → renders children
 */
export default function ProtectedRoute({
  children,
}: {
  children: JSX.Element;
}) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (isAdmin())          return <Navigate to="/admin/clients" replace />;
  return children;
}
