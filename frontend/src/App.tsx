import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute    from "./components/ProtectedRoute";
import AdminRoute        from "./components/AdminRoute";
import Login             from "./pages/Login";
import Dashboard         from "./pages/Dashboard";
import Analyze           from "./pages/Analyze";
import AnalysisResult    from "./pages/AnalysisResult";
import History           from "./pages/History";
import ClientList        from "./pages/admin/ClientList";
import ClientCreate      from "./pages/admin/ClientCreate";
import ClientDetails     from "./pages/admin/ClientDetails";
import AdminAnalytics    from "./pages/admin/AdminAnalytics";
import { isAdmin }       from "./services/auth";

/** Role-aware catch-all redirect */
function RoleRedirect() {
  return <Navigate to={isAdmin() ? "/admin/clients" : "/"} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* ── Client Panel — no brand-config access ── */}
        <Route path="/"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/analyze"      element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
        <Route path="/analysis/:id" element={<ProtectedRoute><AnalysisResult /></ProtectedRoute>} />
        <Route path="/history"      element={<ProtectedRoute><History /></ProtectedRoute>} />

        {/* ── Admin Panel ── */}
        <Route path="/admin/clients"        element={<AdminRoute><ClientList /></AdminRoute>} />
        <Route path="/admin/clients/new"    element={<AdminRoute><ClientCreate /></AdminRoute>} />
        <Route path="/admin/clients/:id"    element={<AdminRoute><ClientDetails /></AdminRoute>} />
        <Route path="/admin/analytics"      element={<AdminRoute><AdminAnalytics /></AdminRoute>} />

        {/* Brand-system config is Admin-only */}
        <Route path="/brand-system/*"       element={<AdminRoute><RoleRedirect /></AdminRoute>} />

        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
