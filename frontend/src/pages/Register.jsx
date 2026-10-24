
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import AuthIntro from "../components/AuthIntro";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
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

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await apiRequest("register", "POST", form);
      navigate("/login", { state: { registered: true } });
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
        <span className="eyebrow">Start with a smile</span>
        <h1>Create Account</h1>
        <p>Join us and book your dental appointment.</p>

        {error && <p className="error" role="alert">{error}</p>}

        <label htmlFor="name">Full Name</label>
        <input
          id="name"
          type="text"
          name="name"
          autoComplete="name"
          maxLength={100}
          placeholder="Your full name"
          value={form.name}
          onChange={handleChange}
          required
        />

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
          autoComplete="new-password"
          name="password"
          value={form.password}
          onChange={handleChange}
          minLength={8}
          required
        />

        <p className="field-hint">At least 8 characters. Your account is for booking patient appointments.</p>
        <button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </main>
  );
}
