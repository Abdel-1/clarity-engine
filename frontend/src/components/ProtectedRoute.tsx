import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, isAdmin, isBrandAdmin } from "../services/auth";

/**
 * ProtectedRoute — guards client-facing routes.
 * - Not logged in   → /login
 * - super admin     → /admin/clients
 * - brand_admin     → /brand/dashboard
 * - client          → renders children
 */
export default function ProtectedRoute({
  children,
}: {
  children: React.ReactElement;
}) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (isAdmin())          return <Navigate to="/admin/clients"    replace />;
  if (isBrandAdmin())     return <Navigate to="/brand/dashboard"  replace />;
  return children;
}

