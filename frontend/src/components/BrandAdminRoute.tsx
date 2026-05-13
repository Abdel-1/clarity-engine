import { Navigate } from "react-router-dom";
import { isAuthenticated, isAdmin, isBrandAdmin } from "../services/auth";

/**
 * BrandAdminRoute — guards routes that require brand_admin role.
 * - Not logged in     → /login
 * - super admin       → /admin/clients  (they have their own panel)
 * - client            → /              (no access to brand admin panel)
 * - brand_admin       → renders children
 */
export default function BrandAdminRoute({ children }: { children: JSX.Element }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (isAdmin())          return <Navigate to="/admin/clients" replace />;
  if (!isBrandAdmin())    return <Navigate to="/" replace />;
  return children;
}
