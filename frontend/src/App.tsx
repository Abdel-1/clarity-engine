import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute    from "./components/ProtectedRoute";
import AuthenticatedRoute from "./components/AuthenticatedRoute";
import AdminRoute        from "./components/AdminRoute";
import BrandAdminRoute   from "./components/BrandAdminRoute";
import Login             from "./pages/Login";
import Dashboard         from "./pages/Dashboard";
import Analyze           from "./pages/Analyze";
import AnalysisResult    from "./pages/AnalysisResult";
import History           from "./pages/History";
import ConversationThread from "./pages/ConversationThread";
import UnreviewedList    from "./pages/UnreviewedList";
import ClientList        from "./pages/admin/ClientList";
import ClientCreate      from "./pages/admin/ClientCreate";
import ClientDetails     from "./pages/admin/ClientDetails";
import AdminAnalytics    from "./pages/admin/AdminAnalytics";
import BrandDashboard    from "./pages/brand/BrandDashboard";
import BrandUsers        from "./pages/brand/BrandUsers";
import Profile           from "./pages/Profile";
import { isAdmin, isBrandAdmin } from "./services/auth";
import { ThemeProvider } from "./context/ThemeContext";

/** Role-aware catch-all redirect */
function RoleRedirect() {
  if (isAdmin())      return <Navigate to="/admin/clients"   replace />;
  if (isBrandAdmin()) return <Navigate to="/brand/dashboard" replace />;
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* ── Client Panel ── */}
          <Route path="/"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/analyze"      element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
          <Route path="/analysis/:id" element={<AuthenticatedRoute><AnalysisResult /></AuthenticatedRoute>} />
          <Route path="/history"                    element={<AuthenticatedRoute><History /></AuthenticatedRoute>} />
          <Route path="/history/:conversation_id"    element={<AuthenticatedRoute><ConversationThread /></AuthenticatedRoute>} />
          <Route path="/unreviewed"                  element={<AuthenticatedRoute><UnreviewedList /></AuthenticatedRoute>} />

          {/* ── Brand Admin Panel ── */}
          <Route path="/brand/dashboard" element={<BrandAdminRoute><BrandDashboard /></BrandAdminRoute>} />
          <Route path="/brand/users"     element={<BrandAdminRoute><BrandUsers /></BrandAdminRoute>} />

          {/* ── Super Admin Panel ── */}
          <Route path="/admin/clients"        element={<AdminRoute><ClientList /></AdminRoute>} />
          <Route path="/admin/clients/new"    element={<AdminRoute><ClientCreate /></AdminRoute>} />
          <Route path="/admin/clients/:id"    element={<AdminRoute><ClientDetails /></AdminRoute>} />
          <Route path="/admin/analytics"      element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
          <Route path="/profile"              element={<AuthenticatedRoute><Profile /></AuthenticatedRoute>} />

          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
