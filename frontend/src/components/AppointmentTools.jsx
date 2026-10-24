import { useId } from "react";
export default function AppointmentTools({ filters, onChange, count, disabled = false }) {
  const id = useId();
  return <div className="appointment-tools">
    <div className="search-field"><label className="sr-only" htmlFor={id + "-search"}>Search appointments</label>
      <span aria-hidden="true" className="search-icon">⌕</span>
      <input id={id + "-search"} type="search" placeholder="Search name, service or date..." value={filters.query} disabled={disabled}
        onChange={e => onChange({ ...filters, query: e.target.value })} /></div>
    <label className="sr-only" htmlFor={id + "-status"}>Appointment status</label>
    <select id={id + "-status"} value={filters.status} disabled={disabled} onChange={e => onChange({ ...filters, status: e.target.value })}>
      <option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
    </select>
    {(filters.query || filters.status !== "all") && <button type="button" className="text-button" onClick={() => onChange({ query: "", status: "all" })}>Clear filters</button>}
    <small className="result-count" role="status">{disabled ? "Loading..." : count + (count === 1 ? " appointment" : " appointments")}</small>
  </div>;
}
