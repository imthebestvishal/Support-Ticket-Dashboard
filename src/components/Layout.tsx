import type { ReactNode } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/gmail", label: "Gmail" },
  { to: "/knowledge-base", label: "Knowledge Base" },
  { to: "/settings", label: "Settings" },
  { to: "/account", label: "Account" },
];

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isWorkspace =
    location.pathname === "/dashboard" ||
    location.pathname === "/gmail" ||
    location.pathname === "/knowledge-base" ||
    location.pathname === "/settings";

  if (isWorkspace) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">SA</div>

          <div>
            <p className="brand-title">Support AI</p>
            <p className="brand-subtitle">
              Agentic dashboard workspace
            </p>
          </div>
        </div>

        <div className="header-right">
          <nav className="app-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link${isActive ? " active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Link className="primary-button" to="/auth">
            Login
          </Link>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>

      <footer className="app-footer">
        Built with React, Vite, and Neon Auth.
      </footer>
    </div>
  );
}



