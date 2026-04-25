import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../services/auth";

export default function ProtectedRoute({
  children,
}: {
  children: JSX.Element;
}) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}
