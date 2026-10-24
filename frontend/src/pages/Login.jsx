
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { apiRequest } from "../services/api";
import AuthIntro from "../components/AuthIntro";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(e) {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const result = await apiRequest("login", "POST", form);
      const role = result.user.role;

      if (role === "admin") navigate("/admin", { replace: true });
      else if (role === "doctor") navigate("/doctor", { replace: true });
      else navigate("/patient", { replace: true });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <AuthIntro />
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">Good to see you again</span>
        <h1>Welcome Back</h1>
        <p>Sign in to make a little time for your smile.</p>
        {location.state?.registered && <p className="success-message" role="status">Your account is ready. Sign in to book your first visit.</p>}

        {error && <p className="error" role="alert">{error}</p>}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          required
        />

        <div className="password-label"><label htmlFor="password">Password</label>
          <button className="password-toggle" type="button" aria-pressed={showPassword} aria-controls="password" onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide" : "Show"}</button>
        </div>
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          name="password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </main>
  );
}
