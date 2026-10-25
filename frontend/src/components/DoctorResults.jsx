import { useState } from "react";
import { serviceValue, formatJod } from "../utils/financials";

export default function DoctorResults({ doctors, appointments, onView }) {
  const [doctorId, setDoctorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState("all");
  const invalid = !!(from && to && from > to);
  const relevant = appointments.filter(a => !invalid && (!doctorId || String(a.doctor_id) === doctorId)
    && (!from || a.slot_date >= from) && (!to || a.slot_date <= to));
  const rows = doctors.filter(d => !doctorId || String(d.id) === doctorId).map(doctor => {
    const bookings = relevant.filter(a => String(a.doctor_id) === String(doctor.id));
    return { ...doctor, completedValue: serviceValue(bookings, ["completed"]), scheduledValue: serviceValue(bookings, ["pending", "confirmed"]), total: bookings.length, pending: bookings.filter(a => a.status === "pending").length,
      confirmed: bookings.filter(a => a.status === "confirmed").length,
      completed: bookings.filter(a => a.status === "completed").length,
      cancelled: bookings.filter(a => a.status === "cancelled").length };
  }).sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name));
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
  return <section className="patient-section" id="doctor-results">
    <h2>Doctor Results &amp; Financial Summary</h2>
    <p className="section-description">Appointment outcomes by doctor, based on the appointment date. These counts describe booking activity, not clinical outcomes or quality of care. Cancelled bookings include patient and administrative cancellations.</p>
    <div className="results-periods" role="group" aria-label="Results period">
      {[["all", "All time"], ["today", "Today"], ["week", "Last 7 days"], ["month", "Last 30 days"]].map(([key, label]) => <button type="button" key={key} className="admin-secondary" aria-pressed={period === key} onClick={() => choosePeriod(key)}>{label}</button>)}
    </div>
    <div className="admin-appointment-filters">
      <label>Doctor<select value={doctorId} onChange={e => setDoctorId(e.target.value)}><option value="">All doctors</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>From date<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPeriod("custom"); }} /></label>
      <label>To date<input type="date" min={from || undefined} value={to} onChange={e => { setTo(e.target.value); setPeriod("custom"); }} /></label>
      <button type="button" className="admin-secondary" onClick={() => { setDoctorId(""); choosePeriod("all"); }}>Reset results</button>
    </div>
    {invalid ? <p className="error-message" role="alert">The end date must be on or after the start date.</p> : <>
      <div className="service-grid results-totals" aria-label="Results totals">
        {[["Total bookings", relevant.length], ["Completed", relevant.filter(a => a.status === "completed").length], ["Confirmed", relevant.filter(a => a.status === "confirmed").length], ["Pending", relevant.filter(a => a.status === "pending").length], ["Cancelled", relevant.filter(a => a.status === "cancelled").length]].map(([label, count]) => <article className="service-card" key={label}><h3>{label}</h3><strong>{count}</strong></article>)}
      </div>
      <h3>Estimated service values</h3>
      <p className="section-description">Calculated using current service prices for the selected appointment dates. These are service values, not collected payments, profit, or doctor payouts. Cancelled bookings are excluded. Price changes affect these estimates.</p>
      <div className="service-grid results-totals" aria-label="Estimated financial totals">
        <article className="service-card"><h3>Completed visits · estimated value</h3><strong className="financial-value">{formatJod(serviceValue(relevant, ["completed"]))}</strong></article>
        <article className="service-card"><h3>Pending + confirmed · estimated value</h3><strong className="financial-value">{formatJod(serviceValue(relevant, ["pending", "confirmed"]))}</strong></article>
      </div>
      <p className="section-description" role="status">{relevant.length} bookings across {rows.length} doctors in this selection.</p>
      {rows.length ? <div className="results-table-wrap" role="region" aria-label="Doctor appointment results" tabIndex={0}><table className="results-table">
        <caption>Booking status per doctor for the selected appointment dates</caption>
        <thead><tr><th scope="col">Doctor</th><th scope="col">Total</th><th scope="col">Completed</th><th scope="col">Confirmed</th><th scope="col">Pending</th><th scope="col">Cancelled</th><th scope="col">Completed value (est.)</th><th scope="col">Pending + confirmed value (est.)</th><th scope="col">Details</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.total}</td><td>{row.completed}</td><td>{row.confirmed}</td><td>{row.pending}</td><td>{row.cancelled}</td><td>{formatJod(row.completedValue)}</td><td>{formatJod(row.scheduledValue)}</td><td><button type="button" className="text-button" aria-label={"View bookings for " + row.name} onClick={() => onView(String(row.id), from, to)}>View bookings →</button></td></tr>)}</tbody>
      </table></div> : <p>No doctors found.</p>}
      {!relevant.length && rows.length > 0 && <p>No bookings in this period. Try a wider date range.</p>}
    </>}
  </section>;
}
