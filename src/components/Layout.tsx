import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import InstallBanner from "./InstallBanner";
import Icon, { type IconName } from "./Icon";
import { Avatar } from "./ui";

type Item = { to: string; label: string; icon: IconName };
const NAV: Record<string, Item[]> = {
  admin: [
    { to: "/", label: "Dashboard", icon: "dashboard" },
    { to: "/clients", label: "Clients", icon: "clients" },
    { to: "/tasks", label: "Tasks", icon: "tasks" },
    { to: "/employees", label: "Team", icon: "team" },
    { to: "/settings", label: "Settings", icon: "settings" },
  ],
  employee: [
    { to: "/", label: "My tasks", icon: "tasks" },
    { to: "/clients", label: "My clients", icon: "clients" },
  ],
  client: [{ to: "/", label: "My project", icon: "project" }],
  pending: [],
};

export default function Layout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const items = profile ? NAV[profile.role] ?? [] : [];
  const name = profile?.full_name || profile?.email || "";

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <div className="topbar-mobile">
        <div className="brand" style={{ padding: 0 }}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /> Curlywave OS</div>
        <button className="btn sm icon-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Icon name="menu" /></button>
      </div>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <div className="shell">
        <aside className={`sidebar ${open ? "open" : ""}`} onClick={() => setOpen(false)} aria-label="Main menu">
          <div className="brand"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /> Curlywave OS</div>
          <div className="nav-label">Workspace</div>
          <nav className="nav" aria-label="Main">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.to === "/"}
                className={({ isActive }) => (isActive || (i.to !== "/" && loc.pathname.startsWith(i.to)) ? "active" : "")}>
                <Icon name={i.icon} />{i.label}
              </NavLink>
            ))}
            <NavLink to="/account"><Icon name="account" />My account</NavLink>
          </nav>
          <div className="me">
            <div className="me-row">
              <Avatar name={name} />
              <div style={{ minWidth: 0 }}>
                <div className="name">{name}</div>
                <div className="role">{profile?.role}{profile?.designation ? ` · ${profile.designation}` : ""}</div>
              </div>
            </div>
            <button className="btn sm ghost signout" onClick={signOut}><Icon name="logout" size={16} />Sign out</button>
            <div className="legal-links"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link></div>
          </div>
        </aside>
        <main className="main" id="main" tabIndex={-1}>
          <InstallBanner />
          <Outlet />
        </main>
      </div>
    </>
  );
}
