import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, isAdmin } from "../services/auth";

/**
 * AdminRoute — allows only authenticated users whose role is "admin".
 * - Not logged in  → /login
 * - Logged in as client → / (dashboard)
 * - Logged in as admin  → renders children
 */
export default function AdminRoute({ children }: { children: React.ReactElement }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!isAdmin())         return <Navigate to="/"      replace />;
  return children;
}
