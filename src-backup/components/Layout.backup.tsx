import type { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/auth", label: "Auth" },
  { to: "/account", label: "Account" },
];

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">✨</div>
          <div>
            <p className="brand-title">Neon Auth</p>
            <p className="brand-subtitle">Agentic dashboard workspace</p>
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
            Launch Auth
          </Link>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        Built with React, Vite, and Neon Auth.
      </footer>
    </div>
  );
}
