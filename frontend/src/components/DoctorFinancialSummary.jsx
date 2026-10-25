import { useState } from "react";
import { serviceValue, formatJod } from "../utils/financials";
import { formatDate } from "../utils/appointments";

export default function DoctorFinancialSummary({ appointments, loading }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState("all");
  const invalid = !!(from && to && from > to);
  const visits = appointments.filter(a => !invalid && (!from || a.slot_date >= from) && (!to || a.slot_date <= to));
  const completed = visits.filter(a => a.status === "completed");
  const scheduled = visits.filter(a => ["pending", "confirmed"].includes(a.status));
  const services = [...new Set(visits.filter(a => a.status !== "cancelled").map(a => a.service_name))].sort();
  function choosePeriod(value) {
    setPeriod(value);
    if (value === "all") { setFrom(""); setTo(""); return; }
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const get = key => parts.find(p => p.type === key).value;
    const today = get("year") + "-" + get("month") + "-" + get("day");
    const start = new Date(today + "T12:00:00Z");
    start.setUTCDate(start.getUTCDate() - (value === "week" ? 6 : value === "month" ? 29 : 0));
    setFrom(start.toISOString().slice(0, 10)); setTo(today);
  }
  return <section className="patient-section" id="my-financials">
    <h2>My Financial Summary</h2>
    <p className="section-description">Estimated service values for your appointments only, based on current prices and appointment dates. These are not collected payments or your personal payout. Cancelled visits are excluded; price changes affect estimates.</p>
    <div className="results-periods" role="group" aria-label="Financial period">
      {[["all", "All time"], ["today", "Today"], ["week", "Last 7 days"], ["month", "Last 30 days"]].map(([key, label]) => <button className="admin-secondary" type="button" key={key} aria-pressed={period === key} onClick={() => choosePeriod(key)}>{label}</button>)}
    </div>
    <div className="admin-appointment-filters">
      <label>From date<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPeriod("custom"); }} /></label>
      <label>To date<input type="date" min={from || undefined} value={to} onChange={e => { setTo(e.target.value); setPeriod("custom"); }} /></label>
      <button type="button" className="admin-secondary" onClick={() => choosePeriod("all")}>Reset period</button>
    </div>
    {loading ? <p role="status">Loading financial summary...</p> : invalid ? <p className="error-message" role="alert">The end date must be on or after the start date.</p> : <>
      <div className="service-grid results-totals">
        <article className="service-card"><h3>Completed visits · estimated value</h3><strong className="financial-value">{formatJod(serviceValue(completed, ["completed"]))}</strong><p>{completed.length} completed visits</p></article>
        <article className="service-card"><h3>Pending + confirmed · estimated value</h3><strong className="financial-value">{formatJod(serviceValue(scheduled, ["pending", "confirmed"]))}</strong><p>{scheduled.length} pending or confirmed visits</p></article>
      </div>
      {services.length ? <div className="results-table-wrap" role="region" aria-label="My service values" tabIndex={0}><table className="results-table">
        <caption>Service breakdown · {from ? formatDate(from) : "All dates"}{to ? " to " + formatDate(to) : ""}</caption>
        <thead><tr><th scope="col">Service</th><th scope="col">Completed visits</th><th scope="col">Completed value (est.)</th><th scope="col">Pending + confirmed value (est.)</th></tr></thead>
        <tbody>{services.map(name => { const group = visits.filter(a => a.service_name === name); return <tr key={name}><th scope="row">{name}</th><td>{group.filter(a => a.status === "completed").length}</td><td>{formatJod(serviceValue(group, ["completed"]))}</td><td>{formatJod(serviceValue(group, ["pending", "confirmed"]))}</td></tr>; })}</tbody>
      </table></div> : <p>No non-cancelled appointments in this period.</p>}
    </>}
  </section>;
}
