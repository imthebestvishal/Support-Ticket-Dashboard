import { Link } from "react-router-dom";

export default function Account() {
  return (
    <div className="page-panel account-page">
      <div className="account-header">
        <div>
          <p className="eyebrow">Profile overview</p>
          <h1 className="page-title">Aisha Nguyen</h1>
          <p className="page-copy">
            Manage your user profile and review auth session details for your
            Neon Auth environment.
          </p>
        </div>
        <div className="account-pill">Active</div>
      </div>

      <div className="account-grid">
        <div className="card">
          <h2>Account details</h2>
          <div className="detail-row">
            <span>Email</span>
            <strong>aisha@example.com</strong>
          </div>
          <div className="detail-row">
            <span>Role</span>
            <strong>Team lead</strong>
          </div>
          <div className="detail-row">
            <span>Workspace</span>
            <strong>Neon Agent UI</strong>
          </div>
        </div>
        <div className="card">
          <h2>Session summary</h2>
          <div className="detail-row">
            <span>Recent sign-ins</span>
            <strong>3</strong>
          </div>
          <div className="detail-row">
            <span>Pending approvals</span>
            <strong>1</strong>
          </div>
          <div className="detail-row">
            <span>Security score</span>
            <strong>94%</strong>
          </div>
          <Link className="inline-link" to="/auth">
            Return to auth
          </Link>
        </div>
      </div>
    </div>
  );
}



