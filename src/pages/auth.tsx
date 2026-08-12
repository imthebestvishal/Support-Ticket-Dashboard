import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth";

export default function Auth() {
  const navigate = useNavigate();

  const [view, setView] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      try {
        const result = await authClient.getSession();

        if (result?.data?.session) {
          navigate("/account", { replace: true });
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
    };

    checkSession();
  }, [navigate]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (view === "signup") {
        const result = await authClient.signUp.email({
          email,
          password,
          name,
        });

        if (result?.error) {
          throw result.error;
        }

        setMessage(
          "Account created successfully. You can now sign in.",
        );

        setView("signin");
        setPassword("");
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result?.error) {
          throw result.error;
        }

        setMessage("Signed in successfully.");

        navigate("/account", { replace: true });
      }
    } catch (err: any) {
      console.error("Authentication error:", err);

      setError(
        err?.message ||
          err?.error?.message ||
          "Authentication failed. Please check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-panel auth-panel">
      <div className="auth-hero">
        <div>
          <p className="eyebrow">Secure access</p>

          <h1 className="page-title">
            {view === "signin" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="page-copy">
            {view === "signin"
              ? "Sign in to continue to your workspace."
              : "Create an account to get started with your workspace."}
          </p>
        </div>
      </div>

      <div className="auth-card-grid">
        <div className="auth-card">
          <div className="action-row">
            <button
              type="button"
              onClick={() => {
                setView("signin");
                setError("");
                setMessage("");
              }}
              className={view === "signin" ? "active-toggle" : ""}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setView("signup");
                setError("");
                setMessage("");
              }}
              className={view === "signup" ? "active-toggle" : ""}
            >
              Sign Up
            </button>
          </div>

          {message && (
            <div className="auth-success">
              {message}
            </div>
          )}

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {view === "signup" && (
                <label>
                  Name

                  <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    className="field"
                    placeholder="Your name"
                    required
                  />
                </label>
              )}

              <label>
                Email

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  className="field"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                Password

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className="field"
                  placeholder="••••••••"
                  required
                />
              </label>

              <button type="submit" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : view === "signin"
                    ? "Login"
                    : "Create Account"}
              </button>
            </div>
          </form>
        </div>

        <div className="auth-summary-card">
          <h2>Your workspace</h2>

          <div className="summary-item-row">
            <div>
              <span>Authentication</span>
              <strong>Neon Auth</strong>
            </div>

            <div>
              <span>Security</span>
              <strong>Protected</strong>
            </div>
          </div>

          <div className="summary-item-row">
            <div>
              <span>Account</span>
              <strong>Personal</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>Ready</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
