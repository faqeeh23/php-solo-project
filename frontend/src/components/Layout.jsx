import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import "../style/layout.css";

const dashboards = { patient: "/patient", doctor: "/doctor", admin: "/admin" };

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState({ pathname: null, user: null });
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const user = session.pathname === pathname ? session.user : null;
  const checking = session.pathname !== pathname;
  const dashboard = dashboards[user?.role];

  useEffect(() => {
    let active = true;
    apiRequest("me").then(data => {
      if (active) setSession({ pathname, user: data.user });
    }).catch(() => {
      if (active) setSession({ pathname, user: null });
    });
    return () => { active = false; };
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await apiRequest("logout", "POST");
      setSession({ pathname, user: null });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="site-layout">
      <a className="skip-link" href="#page-content">Skip to content</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-brand" to={dashboard || "/login"} aria-label="DentalCare home">
            <span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 36" fill="none"><path d="M16 5C10 1 3 4 3 11c0 6 4 8 5 16 1 7 3 9 5 1l1-5c1-3 3-3 4 0l1 5c2 8 4 6 5-1 1-8 5-10 5-16 0-7-7-10-13-6Z" fill="currentColor" /></svg></span>
            <span>Dental<span className="brand-accent">Care</span><small>Appointment System</small></span>
          </Link>
          <nav className="site-nav" aria-label="Main navigation">
            {checking ? <span className="nav-loading" role="status">Checking session...</span> : user && dashboard ? (
              <>
                <NavLink to={dashboard}>Overview</NavLink>
                <a href={dashboard + "#appointments"}>Appointments</a>
                <span className="nav-user">{user.name}<small>{user.role}</small></span>
                <button className="nav-button" onClick={logout} disabled={loggingOut}>
                  {loggingOut ? "Signing out..." : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Sign in</NavLink>
                <NavLink className="nav-primary" to="/register">Create account</NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      {error && <p className="layout-error" role="alert">{error}</p>}
      <div id="page-content" className="site-content" tabIndex={-1}><Outlet /></div>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div><strong>DentalCare</strong><p>Your dental appointments, made simple.</p></div>
          <nav aria-label="Footer navigation">
            {dashboard ? <Link to={dashboard}>My dashboard</Link> : <><Link to="/login">Sign in</Link><Link to="/register">Create account</Link></>}
          </nav>
          <small>&copy; {new Date().getFullYear()} DentalCare. All rights reserved.</small>
        </div>
      </footer>
    </div>
  );
}
