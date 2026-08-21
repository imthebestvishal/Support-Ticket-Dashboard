import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ScrollShowcase from "../components/ScrollShowcase";

type LandingTab = "Home" | "Features" | "Help Center" | "About";

const featureHighlights = [
  {
    kicker: "Deadline alarms",
    title: "Alarm for deadline tasks",
    copy: "Surface time-sensitive tickets before they slip, with a clean reminder workflow for support tasks.",
  },
  {
    kicker: "Volume alerts",
    title: "High-volume email notification",
    copy: "Call attention to sudden inbox spikes so the team can react before queues become noisy.",
  },
  {
    kicker: "Calendar-ready",
    title: "Add ticket deadlines to calendar",
    copy: "Keep customer follow-ups visible by turning important ticket deadlines into calendar moments.",
  },
];

const helpCenterFaqs = [
  {
    question: "How does SentiMail integrate with Gmail?",
    answer:
      "SentiMail connects seamlessly via Google OAuth 2.0 and official Gmail APIs to analyze support emails, categorize them automatically into 6 priority types, and generate AI-driven summaries without storing sensitive credentials.",
  },
  {
    question: "How does AI Email Categorization work?",
    answer:
      "Our AI engine inspects incoming email subjects, body copy, and sender metadata to classify messages into Social, Financial, Technical, Promotions, Feature Requests, and General support categories.",
  },
  {
    question: "How do I create and manage tickets?",
    answer:
      "You can create manual tickets from the Workspace dashboard or convert incoming emails into tracked tickets with assigned priority levels (High, Medium, Low) and live status tracking.",
  },
  {
    question: "What capabilities does the AI Assistant offer?",
    answer:
      "The integrated AI Assistant provides real-time intelligent insights over your support data, answers natural language queries about ticket trends, and drafts instant response recommendations.",
  },
];

const projectHighlights = [
  {
    title: "AI-Powered Triage",
    desc: "Automated email classification and priority detection powered by Google Gemini AI.",
  },
  {
    title: "Real-Time Workspace",
    desc: "Dynamic live metrics, stat breakdown cards, deadline tracking, and ticket workflow management.",
  },
  {
    title: "Theme Customization",
    desc: "Complete Light & Dark mode visual themes with dedicated dark PNG icon assets.",
  },
  {
    title: "Tech Stack",
    desc: "React 18, TypeScript, Vite, Node.js, Express, MongoDB, Google OAuth 2.0 & Gemini API.",
  },
];

type FeatureIconName = "mail" | "analytics" | "assistant" | "alarm";

function FeatureIcon({ name }: { name: FeatureIconName }) {
  const paths: Record<FeatureIconName, JSX.Element> = {
    mail: (
      <>
        <path d="M4 7.5h16v10.2H4z" />
        <path d="m4.7 8.2 7.3 5.5 7.3-5.5" />
      </>
    ),
    analytics: (
      <>
        <path d="M5.5 18V9.5" />
        <path d="M12 18V6" />
        <path d="M18.5 18v-5.5" />
        <path d="M4 18h16" />
      </>
    ),
    assistant: (
      <>
        <path d="M8 10.5h8" />
        <path d="M9.5 15h5" />
        <path d="M7 6.5h10a3 3 0 0 1 3 3v4.8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3z" />
        <path d="M12 6.5V3.8" />
        <path d="M8.5 3.8h7" />
      </>
    ),
    alarm: (
      <>
        <path d="M7.5 4.5 4.8 7.2" />
        <path d="m16.5 4.5 2.7 2.7" />
        <path d="M12 7a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
        <path d="M12 10.2v3.5l2.4 1.5" />
      </>
    ),
  };

  return (
    <span className={`feature-icon-badge feature-icon-${name}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        {paths[name]}
      </svg>
    </span>
  );
}

function Logo() {
  return (
    <Link to="/" className="landing-logo" aria-label="SentiMail home">
      <img src="/assets/brand_logo.png" alt="SentiMail" className="landing-logo-image" />
    </Link>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LandingTab>("Home");
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  const scrollToSection = (sectionId: string, tabName: LandingTab) => {
    setActiveTab(tabName);
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -70;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const animatedNodes = Array.from(
      document.querySelectorAll<HTMLElement>(".scroll-reveal")
    );

    if (animatedNodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.18,
      }
    );

    animatedNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScrollSpy = () => {
      setIsHeaderHidden(window.scrollY > 8);

      const sections: { id: string; tab: LandingTab }[] = [
        { id: "home", tab: "Home" },
        { id: "features", tab: "Features" },
        { id: "help-center", tab: "Help Center" },
        { id: "about", tab: "About" },
      ];

      const scrollPosition = window.scrollY + 140;

      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveTab(section.tab);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScrollSpy, { passive: true });
    handleScrollSpy();

    return () => window.removeEventListener("scroll", handleScrollSpy);
  }, []);

  return (
    <main className="landing-page-container minimal-landing">
      <header className={`landing-header${isHeaderHidden ? " is-hidden" : ""}`}>
        <Logo />

        <div className="landing-tab-bar" aria-label="Landing navigation tabs">
          {[
            { name: "Home", id: "home" },
            { name: "Features", id: "features" },
            { name: "Help Center", id: "help-center" },
            { name: "About", id: "about" },
          ].map((tab) => (
            <button
              key={tab.name}
              type="button"
              className={`landing-tab-item${activeTab === tab.name ? " is-active" : ""}`}
              onClick={() => scrollToSection(tab.id, tab.name as LandingTab)}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <nav className="landing-nav" aria-label="Landing navigation">
          <Link to="/auth?mode=signin" className="nav-signin-link">
            Sign In
          </Link>
          <Link to="/auth?mode=signup" className="nav-signup-button">
            Sign Up
          </Link>
        </nav>
      </header>

      {/* SECTION 1: HOME */}
      <section id="home" className="landing-section-block">
        <ScrollShowcase
          totalFrames={180}
          imagePath={(index) => `/assets/sequence/${String(index).padStart(5, "0")}.png`}
        />
      </section>

      {/* SECTION 2: FEATURES */}
      <section id="features" className="landing-section-block landing-feature-band">
        <div className="landing-section-heading scroll-reveal">
          <h2>The next support actions stay visible.</h2>
          <p>
            SentiMail turns Gmail conversations into prioritized support tickets with AI summaries,
            reply assistance, deadline awareness, and team-ready follow-up signals.
          </p>
        </div>

        <div className="landing-feature-grid" style={{ marginBottom: "50px" }}>
          {featureHighlights.map((feature, index) => (
            <article
              className="landing-feature-card scroll-reveal"
              style={{ transitionDelay: `${index * 90}ms` }}
              key={feature.title}
            >
              <span className="feature-number">{String(index + 1).padStart(2, "0")}</span>
              <p>{feature.kicker}</p>
              <h3>{feature.title}</h3>
              <span>{feature.copy}</span>
            </article>
          ))}
        </div>

        <div className="landing-tab-view landing-features-view">
          <div className="tab-hero-heading scroll-reveal">
            <p className="eyebrow">FEATURES & CAPABILITIES</p>
            <h2>Intelligent Support Operations</h2>
            <p className="subtitle">
              Discover how SentiMail automates customer email triage, priority categorization, and task reminders.
            </p>
          </div>

          <div className="features-deep-grid scroll-reveal">
            <div className="deep-feature-card">
              <FeatureIcon name="mail" />
              <h3>Gmail AI Auto-Categorization</h3>
              <p>
                Automatically classifies incoming messages into 6 distinct categories: Social, Financial, Technical, Promotions, Feature Requests, and General support.
              </p>
            </div>

            <div className="deep-feature-card">
              <FeatureIcon name="analytics" />
              <h3>Live Support Analytics</h3>
              <p>
                Real-time total tickets count, resolution rates, high-priority alert cards, and dynamic category breakdown charts with zero hardcoding.
              </p>
            </div>

            <div className="deep-feature-card">
              <FeatureIcon name="assistant" />
              <h3>AI Chat Assistant</h3>
              <p>
                Interact with your support dataset using natural language. Query high-priority tickets, get instant summaries, and auto-draft customer responses.
              </p>
            </div>

            <div className="deep-feature-card">
              <FeatureIcon name="alarm" />
              <h3>Deadline & Volume Alarms</h3>
              <p>
                Receive automated alerts when time-sensitive customer tickets near deadline or when incoming email volume spikes unexpectedly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: HELP CENTER */}
      <section id="help-center" className="landing-section-block landing-tab-view landing-help-view">
        <div className="tab-hero-heading scroll-reveal">
          <p className="eyebrow">HELP CENTER & FAQ</p>
          <h2>How SentiMail Works</h2>
          <p className="subtitle">
            Everything you need to know about setting up Gmail integration, managing tickets, and AI data security.
          </p>
        </div>

        <div className="faq-list scroll-reveal">
          {helpCenterFaqs.map((faq, i) => (
            <div className="faq-item" key={i}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: ABOUT */}
      <section id="about" className="landing-section-block landing-tab-view landing-about-view">
        <div className="tab-hero-heading scroll-reveal">
          <p className="eyebrow">ABOUT SENTIMAIL</p>
          <h2>Empowering Support Teams with AI</h2>
          <p className="subtitle">
            SentiMail is an intelligent support dashboard built to streamline email triage, prioritize customer urgency, and eliminate manual queue management.
          </p>
        </div>

        <div className="about-grid scroll-reveal">
          {projectHighlights.map((item, i) => (
            <div className="about-card" key={i}>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CLOSING HERO CTA */}
      <section className="landing-closing scroll-reveal">
        <h2>Built for scanning, triage, and action.</h2>
        <button onClick={() => navigate("/auth?mode=signup")} className="hero-cta-button">
          <span>Start with SentiMail</span>
          <span className="arrow-icon" aria-hidden="true">
            →
          </span>
        </button>
      </section>
    </main>
  );
}
