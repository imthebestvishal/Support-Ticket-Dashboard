import Sidebar from "../components/Sidebar";

export default function Settings() {
  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h1>Settings</h1>

          <p>
            Manage your support dashboard settings.
          </p>

          <div className="settings-row">
            <span>Email notifications</span>
            <input type="checkbox" defaultChecked />
          </div>

          <div className="settings-row">
            <span>AI suggested replies</span>
            <input type="checkbox" defaultChecked />
          </div>

          <div className="settings-row">
            <span>Automatic Gmail analysis</span>
            <input type="checkbox" defaultChecked />
          </div>
        </div>
      </main>
    </div>
  );
}



