import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import type { KnowledgeArticle } from "../types/ticket";
import {
  getKnowledgeArticles,
  searchKnowledgeArticles,
  seedKnowledgeArticles,
} from "../services/api";

const CATEGORIES = ["All", "Billing", "Technical", "Account", "General"] as const;

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  async function loadArticles(category = selectedCategory) {
    try {
      setLoading(true);
      setError("");

      const data = await getKnowledgeArticles(
        category === "All" ? undefined : category
      );
      setArticles(data);
    } catch (err) {
      console.error("Failed to load knowledge articles:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load knowledge articles."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event?: React.FormEvent) {
    if (event) event.preventDefault();

    const query = searchQuery.trim();
    if (!query) {
      return loadArticles(selectedCategory);
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const results = await searchKnowledgeArticles(query);
      if (selectedCategory !== "All") {
        setArticles(
          results.filter(
            (article) =>
              article.category?.toLowerCase() === selectedCategory.toLowerCase()
          )
        );
      } else {
        setArticles(results);
      }
    } catch (err) {
      console.error("Search failed:", err);
      setError(
        err instanceof Error ? err.message : "Search failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    try {
      setSeeding(true);
      setError("");
      setMessage("");

      const result = await seedKnowledgeArticles();
      setMessage(result.message);
      await loadArticles("All");
      setSelectedCategory("All");
      setSearchQuery("");
      showToast("✓ Standard knowledge articles seeded!");
    } catch (err) {
      console.error("Seed failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to seed sample articles."
      );
    } finally {
      setSeeding(false);
    }
  }

  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    if (!searchQuery.trim()) {
      loadArticles(category);
    }
  }

  function showToast(text: string) {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage("");
    }, 2500);
  }

  function handleCopyArticle(article: KnowledgeArticle) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(article.content);
    }
    setCopiedId(article._id);
    showToast(`✓ Copied "${article.title}" to clipboard!`);
    setTimeout(() => setCopiedId(null), 2500);
  }

  useEffect(() => {
    loadArticles("All");
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main workspace-view-transition">
        {/* Breadcrumb Trail */}
        <div className="breadcrumb-trail">
          <span>Workspace</span>
          <span>/</span>
          <span className="current">Knowledge Base</span>
        </div>

        <div className="dashboard-card kb-container">
          <div className="kb-header">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div>
                <span className="eyebrow" style={{ color: "var(--primary, #599345)", fontWeight: 800 }}>
                  Standard Support Repository
                </span>
                <h1 style={{ margin: "2px 0 0", fontSize: "28px", fontWeight: 800 }}>
                  Knowledge Base & Documentation
                </h1>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted, #64748b)", fontSize: "14px" }}>
                  Search reference documentation, troubleshooting guides, and support policies.
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={handleSeed}
                disabled={seeding || loading}
              >
                {seeding ? "Populating..." : "✦ Seed Standard Articles"}
              </button>
            </div>
          </div>

          {message && <div className="dashboard-message">{message}</div>}
          {error && (
            <div
              className="dashboard-message"
              style={{ background: "rgba(220, 38, 38, 0.12)", color: "#b91c1c" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSearch} className="kb-search-bar" style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <input
              type="text"
              className="search-input"
              style={{ margin: 0 }}
              placeholder="Search articles by title, content, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search knowledge base"
            />
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
            {searchQuery && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSearchQuery("");
                  loadArticles(selectedCategory);
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="kb-category-pills" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`kb-pill ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            /* Shimmering Skeletons */
            <div className="kb-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton-card" style={{ height: "160px" }}>
                  <div className="skeleton-line title"></div>
                  <div className="skeleton-line body"></div>
                  <div className="skeleton-line meta"></div>
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="kb-empty-state">
              <h3>No articles found</h3>
              <p>
                {searchQuery
                  ? `No articles matched your search "${searchQuery}".`
                  : "The knowledge base is currently empty."}
              </p>
              <button
                className="primary-button"
                onClick={handleSeed}
                disabled={seeding}
              >
                {seeding ? "Populating..." : "Populate with Standard Support Articles"}
              </button>
            </div>
          ) : (
            <div className="kb-grid">
              {articles.map((article) => (
                <article
                  key={article._id}
                  className="kb-card hover-lift"
                  onClick={() => setSelectedArticle(article)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Read article: ${article.title}`}
                >
                  <div>
                    <div className="kb-card-header">
                      <h2 className="kb-card-title">{article.title}</h2>
                      <span
                        className={`kb-badge ${
                          article.category ? article.category.toLowerCase() : "general"
                        }`}
                      >
                        {article.category || "General"}
                      </span>
                    </div>

                    <p className="kb-card-snippet">
                      {article.content.length > 140
                        ? `${article.content.slice(0, 140)}...`
                        : article.content}
                    </p>
                  </div>

                  <div>
                    {article.tags && article.tags.length > 0 && (
                      <div className="kb-card-tags" style={{ marginBottom: "12px" }}>
                        {article.tags.map((tag) => (
                          <span key={tag} className="kb-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <span style={{ fontSize: "12px", color: "var(--primary, #599345)", fontWeight: 700 }}>
                      Read Article →
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* ARTICLE DETAIL MODAL */}
          {selectedArticle && (
            <div
              className="kb-modal-backdrop"
              onClick={() => setSelectedArticle(null)}
            >
              <div
                className="kb-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="kb-modal-dialog-title"
              >
                <div className="kb-modal-header">
                  <div>
                    <span
                      className={`kb-badge ${
                        selectedArticle.category
                          ? selectedArticle.category.toLowerCase()
                          : "general"
                      }`}
                    >
                      {selectedArticle.category || "General"}
                    </span>
                    <h2 id="kb-modal-dialog-title" style={{ margin: "8px 0 0", fontSize: "20px" }}>
                      {selectedArticle.title}
                    </h2>
                  </div>

                  <button
                    className="secondary-button"
                    style={{ padding: "6px 12px" }}
                    onClick={() => setSelectedArticle(null)}
                    aria-label="Close article modal"
                  >
                    ✕
                  </button>
                </div>

                <div className="kb-modal-content">
                  {selectedArticle.content}
                </div>

                {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                  <div className="kb-card-tags" style={{ marginBottom: "16px" }}>
                    {selectedArticle.tags.map((tag) => (
                      <span key={tag} className="kb-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="kb-modal-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleCopyArticle(selectedArticle)}
                  >
                    {copiedId === selectedArticle._id ? "✓ Copied Content" : "📋 Copy Content"}
                  </button>

                  <button
                    className="primary-button"
                    onClick={() => setSelectedArticle(null)}
                  >
                    Close Article
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TOAST FEEDBACK */}
        {toastMessage && (
          <div className="toast-feedback" role="status" aria-live="polite">
            <span>{toastMessage}</span>
          </div>
        )}
      </main>
    </div>
  );
}
