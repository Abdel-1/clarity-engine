import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../services/auth";

/**
 * AuthenticatedRoute — allows any authenticated user regardless of role.
 * Used for shared pages like History that are accessible to
 * membre, brand_admin, and admin roles alike.
 */
export default function AuthenticatedRoute({ children }: { children: React.ReactElement }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
}
