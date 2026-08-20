import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="dashboard-page">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Welcome back, Aisha</p>
          <h1 className="hero-title">Agentic AI dashboard</h1>
          <p className="hero-copy">
            Track auth activity, compliance health, and live workspace metrics
            from your Neon Auth front end.
          </p>

          <div className="hero-actions">
            <Link className="button-link" to="/auth">
              Open Auth flow
            </Link>
            <Link className="secondary-link" to="/account">
              View account overview
            </Link>
          </div>
        </div>

        <div className="hero-summary-card">
          <div className="summary-item">
            <span className="summary-label">Compliance pulse</span>
            <strong>94%</strong>
          </div>
          <div className="summary-item">
            <span className="summary-label">Workspaces</span>
            <strong>12 active</strong>
          </div>
          <div className="summary-item">
            <span className="summary-label">Agent uptime</span>
            <strong>99.8%</strong>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card purple">
          <p className="metric-label">Monthly traffic</p>
          <h2>2.4M</h2>
          <p className="metric-copy">
            Sessions across auth and agent workflows.
          </p>
        </article>
        <article className="metric-card green">
          <p className="metric-label">Revenue</p>
          <h2>$12.7K</h2>
          <p className="metric-copy">Estimated ARR from active customers.</p>
        </article>
        <article className="metric-card blue">
          <p className="metric-label">Accuracy</p>
          <h2>97.3%</h2>
          <p className="metric-copy">Model and policy compliance rate.</p>
        </article>
        <article className="metric-card orange">
          <p className="metric-label">Latency</p>
          <h2>234ms</h2>
          <p className="metric-copy">Average authorization response time.</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-card large-card">
          <div className="card-heading">
            <h2>Compliance pulse</h2>
            <span className="badge success">Healthy</span>
          </div>
          <p className="card-copy">
            Overall access and audit checks are within expected thresholds.
          </p>
          <div className="percentage-ring">
            <span>94%</span>
          </div>
          <div className="health-list">
            <div>
              <strong>7</strong>
              <p>Open reviews</p>
            </div>
            <div>
              <strong>24</strong>
              <p>Policy alerts</p>
            </div>
            <div>
              <strong>3</strong>
              <p>Endpoint exceptions</p>
            </div>
          </div>
        </div>

        <div className="dashboard-card activity-card">
          <div className="card-heading">
            <h2>Live run stream</h2>
            <span className="badge neutral">Realtime</span>
          </div>
          <ul className="activity-list">
            <li>
              <span>Auth session created</span>
              <strong>Just now</strong>
            </li>
            <li>
              <span>Policy evaluation passed</span>
              <strong>2 min ago</strong>
            </li>
            <li>
              <span>New workspace deployed</span>
              <strong>12 min ago</strong>
            </li>
            <li>
              <span>Agent prompt routed</span>
              <strong>18 min ago</strong>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}



