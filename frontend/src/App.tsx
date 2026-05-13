import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute    from "./components/ProtectedRoute";
import AdminRoute        from "./components/AdminRoute";
import BrandAdminRoute   from "./components/BrandAdminRoute";
import Login             from "./pages/Login";
import Dashboard         from "./pages/Dashboard";
import Analyze           from "./pages/Analyze";
import AnalysisResult    from "./pages/AnalysisResult";
import History           from "./pages/History";
import ClientList        from "./pages/admin/ClientList";
import ClientCreate      from "./pages/admin/ClientCreate";
import ClientDetails     from "./pages/admin/ClientDetails";
import AdminAnalytics    from "./pages/admin/AdminAnalytics";
import BrandDashboard    from "./pages/brand/BrandDashboard";
import BrandUsers        from "./pages/brand/BrandUsers";
import { isAdmin, isBrandAdmin } from "./services/auth";

/** Role-aware catch-all redirect */
function RoleRedirect() {
  if (isAdmin())      return <Navigate to="/admin/clients"   replace />;
  if (isBrandAdmin()) return <Navigate to="/brand/dashboard" replace />;
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* ── Client Panel ── */}
        <Route path="/"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/analyze"      element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
        <Route path="/analysis/:id" element={<ProtectedRoute><AnalysisResult /></ProtectedRoute>} />
        <Route path="/history"      element={<ProtectedRoute><History /></ProtectedRoute>} />

        {/* ── Brand Admin Panel ── */}
        <Route path="/brand/dashboard" element={<BrandAdminRoute><BrandDashboard /></BrandAdminRoute>} />
        <Route path="/brand/users"     element={<BrandAdminRoute><BrandUsers /></BrandAdminRoute>} />

        {/* ── Super Admin Panel ── */}
        <Route path="/admin/clients"        element={<AdminRoute><ClientList /></AdminRoute>} />
        <Route path="/admin/clients/new"    element={<AdminRoute><ClientCreate /></AdminRoute>} />
        <Route path="/admin/clients/:id"    element={<AdminRoute><ClientDetails /></AdminRoute>} />
        <Route path="/admin/analytics"      element={<AdminRoute><AdminAnalytics /></AdminRoute>} />

        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
