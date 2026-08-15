import Sidebar from "../components/Sidebar";

export default function KnowledgeBase() {
  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h1>Knowledge Base</h1>

          <p>
            Search support documentation and knowledge articles.
          </p>

          <input
            className="search-input"
            placeholder="Search knowledge base..."
          />

          <div className="knowledge-placeholder">
            Knowledge base functionality can be connected
            to your backend here.
          </div>
        </div>
      </main>
    </div>
  );
}



