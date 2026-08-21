import { NavLink } from "react-router-dom";

const items = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/gmail", label: "Gmail Inbox" },
  { to: "/knowledge-base", label: "Knowledge Base" },
  { to: "/settings", label: "Settings" },
  { to: "/account", label: "Account" },
];

export default function Sidebar() {
  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">SA</div>

        <div>
          <strong>Support AI</strong>
          <small>Agentic Workspace</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
