import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import InstallBanner from "./InstallBanner";

const NAV = {
  admin: [
    { to: "/", label: "Dashboard", icon: "▦" },
    { to: "/clients", label: "Clients", icon: "◉" },
    { to: "/tasks", label: "Tasks", icon: "☑" },
    { to: "/employees", label: "Team", icon: "👥" },
    { to: "/settings", label: "Settings", icon: "⚙" },
  ],
  employee: [
    { to: "/", label: "My tasks", icon: "☑" },
    { to: "/clients", label: "My clients", icon: "◉" },
  ],
  client: [{ to: "/", label: "My project", icon: "◉" }],
  pending: [],
} as const;

export default function Layout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const items = profile ? NAV[profile.role] : [];

  return (
    <>
      <div className="topbar-mobile">
        <div className="brand" style={{ padding: 0 }}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /> Curlywave OS</div>
        <button className="btn sm" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>☰</button>
      </div>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <div className="shell">
        <aside className={`sidebar ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
          <div className="brand"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /> Curlywave OS</div>
          <nav className="nav">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.to === "/"}
                className={({ isActive }) => (isActive || (i.to !== "/" && loc.pathname.startsWith(i.to)) ? "active" : "")}>
                <span aria-hidden>{i.icon}</span>{i.label}
              </NavLink>
            ))}
            <NavLink to="/account"><span aria-hidden>👤</span>My account</NavLink>
          </nav>
          <div className="me">
            <div className="name">{profile?.full_name || profile?.email}</div>
            <div className="role">{profile?.role}{profile?.designation ? ` · ${profile.designation}` : ""}</div>
            <button className="btn sm" onClick={signOut}>Sign out</button>
          </div>
        </aside>
        <main className="main">
          <InstallBanner />
          <Outlet />
        </main>
      </div>
    </>
  );
}
