import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute     from "./components/ProtectedRoute";
import Login              from "./pages/Login";
import Dashboard          from "./pages/Dashboard";
import Analyze            from "./pages/Analyze";
import AnalysisResult     from "./pages/AnalysisResult";
import BrandSystemNew     from "./pages/BrandSystemNew";
import BrandSystemEdit    from "./pages/BrandSystemEdit";
import BrandSystemImport  from "./pages/BrandSystemImport";
import AdminDashboard     from "./pages/AdminDashboard";
import AdminClientDetail  from "./pages/AdminClientDetail";
import History            from "./pages/History";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/"                    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/analyze"             element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
        <Route path="/analysis/:id"        element={<ProtectedRoute><AnalysisResult /></ProtectedRoute>} />
        <Route path="/brand-system/new"    element={<ProtectedRoute><BrandSystemNew /></ProtectedRoute>} />
        <Route path="/brand-system/import" element={<ProtectedRoute><BrandSystemImport /></ProtectedRoute>} />
        <Route path="/brand-system/:id/edit" element={<ProtectedRoute><BrandSystemEdit /></ProtectedRoute>} />
        <Route path="/history"             element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/admin"                    element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/clients/:clientId"  element={<ProtectedRoute adminOnly><AdminClientDetail /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
