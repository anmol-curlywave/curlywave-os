import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Tasks from "./pages/Tasks";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail";
import Settings from "./pages/Settings";
import Portal from "./pages/Portal";
import Account from "./pages/Account";
import { Loading } from "./components/ui";
import Legal, { LEGAL_PATHS } from "./pages/Legal";
import Consent from "./pages/Consent";
import CookieNotice from "./components/CookieNotice";
import { CONSENT_VERSION } from "./lib/supabase";

export default function App() {
  return <><Screens /><CookieNotice /></>;
}

function Screens() {
  const { session, profile, profileError, loading, recovery, signOut, refreshProfile } = useAuth();
  const loc = useLocation();

  // Privacy, Terms and Cookie pages are public: readable signed in or not.
  const legal = LEGAL_PATHS[loc.pathname.replace(/\/+$/, "")];
  if (legal) return <Legal page={legal} />;

  if (loading) return <div className="center-screen"><Loading /></div>;
  if (!session) return <Login />;
  if (profileError) {
    return (
      <div className="center-screen">
        <div className="card auth-card">
          <h2>Couldn't load your account</h2>
          <p className="muted">{profileError} Check your internet connection and try again.</p>
          <div className="row"><button className="btn primary" onClick={refreshProfile}>Try again</button><button className="btn" onClick={signOut}>Sign out</button></div>
        </div>
      </div>
    );
  }
  if (!profile) return <div className="center-screen"><Loading /></div>;
  if (recovery) return <Account recoveryMode />;
  // DPDP consent: ask once (and again when the policy version changes). Skipped until migration 0006 adds the column.
  if ("consent_version" in profile && profile.consent_version !== CONSENT_VERSION && profile.is_active) return <Consent />;

  if (profile.role === "pending" || !profile.is_active) {
    return (
      <div className="center-screen">
        <div className="card auth-card">
          <h2>Waiting for access</h2>
          <p className="muted">Your login ({profile.email}) exists but an admin hasn't given you access yet. Ask your Curlywave admin to approve you.</p>
          <div className="row"><button className="btn" onClick={refreshProfile}>Check again</button><button className="btn" onClick={signOut}>Sign out</button></div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {profile.role === "admin" && (
          <>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employees/:id" element={<EmployeeDetail />} />
            <Route path="settings" element={<Settings />} />
          </>
        )}
        {profile.role === "employee" && (
          <>
            <Route index element={<Tasks mine />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
          </>
        )}
        {profile.role === "client" && <Route index element={<Portal />} />}
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
