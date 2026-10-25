import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "../style/patient.css";
import ConfirmButton from "../components/ConfirmButton";
import AppointmentTools from "../components/AppointmentTools";
import { filterAppointments, formatDate } from "../utils/appointments";

export default function Doctor() {
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceForm, setServiceForm] = useState({ name: "", duration_minutes: "", price: "" });
  const [savingService, setSavingService] = useState(false);
  const [filters, setFilters] = useState({ query: "", status: "all" });
  const [appointmentDate, setAppointmentDate] = useState("");
  const [visitScope, setVisitScope] = useState("all");
  const [slotScope, setSlotScope] = useState("all");
  const [slotDate, setSlotDate] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date(now));
  const startsAt = item => new Date(item.starts_at || item.slot_date + "T" + item.start_time).getTime();
  const endsAt = item => new Date(item.ends_at || item.slot_date + "T" + item.end_time).getTime();
  const activeVisit = a => ["pending", "confirmed"].includes(a.status);
  const nextVisit = appointments.filter(a => activeVisit(a) && endsAt(a) > now).sort((a, b) => startsAt(a) - startsAt(b))[0];
  const todayVisits = appointments.filter(a => a.slot_date === today && a.status !== "cancelled").length;
  const availableCount = slots.filter(s => !Number(s.is_booked) && startsAt(s) > now).length;
  const visibleAppointments = filterAppointments(appointments, filters)
    .filter(a => (!appointmentDate || a.slot_date === appointmentDate) &&
      (visitScope === "all" || (visitScope === "today" ? a.slot_date === today && a.status !== "cancelled" : activeVisit(a) && endsAt(a) > now)))
    .sort((a, b) => startsAt(a) - startsAt(b));
  const visibleSlots = slots.filter(s => (!slotDate || s.slot_date === slotDate) &&
    (slotScope === "all" || (slotScope === "past" ? startsAt(s) <= now : slotScope === "booked" ? Number(s.is_booked) && startsAt(s) > now : !Number(s.is_booked) && startsAt(s) > now)))
    .sort((a, b) => startsAt(a) - startsAt(b));
  const [form, setForm] = useState({ slot_date: "", start_time: "", end_time: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAppointments() {
    const [data, slotData, serviceData] = await Promise.all([
      apiRequest("doctor-appointments"), apiRequest("doctor-slots"), apiRequest("services")
    ]);
    setAppointments(data);
    setSlots(slotData);
    setServices(serviceData);
  }

  useEffect(() => {
    async function load() {
      try {
        await loadAppointments();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  async function refresh() {
    setRefreshing(true); setError("");
    try { await loadAppointments(); setNow(Date.now()); }
    catch (err) { setError(err.message); }
    finally { setRefreshing(false); }
  }

  async function addService(event) {
    event.preventDefault(); setSavingService(true); setError(""); setMessage("");
    try {
      await apiRequest("doctor-add-service", "POST", { ...serviceForm, duration_minutes: Number(serviceForm.duration_minutes) });
      setServiceForm({ name: "", duration_minutes: "", price: "" });
      setMessage("Service added. Patients can now choose it when booking.");
      await loadAppointments();
    } catch (err) { setError(err.message); }
    finally { setSavingService(false); }
  }

  function reuseSlot(slot) {
    setForm({ slot_date: "", start_time: slot.start_time.slice(0, 5), end_time: slot.end_time.slice(0, 5) });
    document.getElementById("add-slot")?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("slot_date")?.focus({ preventScroll: true });
  }

  function handleChange(e) {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }

  async function handleAddSlot(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (form.end_time <= form.start_time) { setError("End time must be after start time."); return; }
    setSaving(true);

    try {
      await apiRequest("doctor-add-slot", "POST", {
        ...form
      });

      setMessage("Slot created successfully!");
      setForm({
        slot_date: "",
        start_time: "",
        end_time: ""
      });

      await loadAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(id) {
    setError("");
    setMessage("");
    setDeletingId(id);
    try {
      await apiRequest("doctor-delete-slot", "POST", { slot_id: id });
      setMessage("Slot removed successfully!");
      await loadAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function updateStatus(id, status) {
    setError("");
    setMessage("");
    setUpdatingId(id);

    try {
      await apiRequest("doctor-update", "POST", {
        appointment_id: id,
        status
      });

      setMessage("Appointment updated successfully!");
      await loadAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }



  const pending = appointments.filter(a => a.status === "pending").length;
  const confirmed = appointments.filter(a => a.status === "confirmed").length;
  const completed = appointments.filter(a => a.status === "completed").length;

  return (
    <main className="patient-page doctor-dashboard">
      <header className="patient-header">
        <span className="eyebrow">Doctor workspace</span>
        <h1>Doctor Dashboard</h1>
        <p>A clear view of your day. Set your availability and care for your patients.</p>
      </header>
      <nav className="dashboard-shortcuts" aria-label="Dashboard sections"><a href="#add-slot">Add availability <span aria-hidden="true">↗</span></a><a href="#appointments">Appointments <span aria-hidden="true">↗</span></a><a href="#my-slots">My schedule <span aria-hidden="true">↗</span></a><a href="#clinic-services">Services <span aria-hidden="true">↗</span></a></nav>

      {message && <p role="status" className="success-message">{message}</p>}
      {error && <p role="alert" className="error-message">{error}</p>}

      <section className="patient-section">
<div className="admin-section-heading"><div><h2>Appointment Overview</h2><p className="section-description">Your practice at a glance. Dates use clinic time (Amman).</p></div><button type="button" className="admin-secondary" onClick={refresh} disabled={refreshing || saving || deletingId !== null || updatingId !== null}>{refreshing ? "Refreshing..." : "Refresh schedule"}</button></div>

        <div className="service-grid">
          <article className="service-card"><h3>Today’s visits</h3><strong>{loading ? "—" : todayVisits}</strong></article>
          <article className="service-card"><h3>Available slots</h3><strong>{loading ? "—" : availableCount}</strong></article>
          <article className="service-card">
            <h3>Total Appointments</h3>
            <strong>{appointments.length}</strong>
          </article>

          <article className="service-card">
            <h3>Pending</h3>
            <strong>{pending}</strong>
          </article>

          <article className="service-card">
            <h3>Confirmed</h3>
            <strong>{confirmed}</strong>
          </article>

          <article className="service-card">
            <h3>Completed</h3>
            <strong>{completed}</strong>
          </article>
        </div>
      </section>
      {!loading && <section className="patient-section next-visit"><div><span className="eyebrow">Up next</span><h2>{nextVisit ? nextVisit.patient_name : "Your schedule has some breathing room"}</h2><p>{nextVisit ? nextVisit.service_name + " · " + formatDate(nextVisit.slot_date) + " · " + nextVisit.start_time.slice(0, 5) + "–" + nextVisit.end_time.slice(0, 5) : "No upcoming bookings. Add available times for patients to book."}</p></div><a href={nextVisit ? "#appointments" : "#add-slot"}>{nextVisit ? "View appointments →" : "Add availability →"}</a></section>}

          <section className="patient-section" id="add-slot">
            <h2>Add Available Slot</h2>
            <p className="section-description">Make time for your patients. New availability is ready to book immediately.</p>

            <form className="booking-form" onSubmit={handleAddSlot}>
              <label htmlFor="slot_date">Date</label>
              <input
                id="slot_date"
                min={today}
                disabled={saving}
                type="date"
                name="slot_date"
                value={form.slot_date}
                onChange={handleChange}
                required
              />

              <label htmlFor="start_time">Start Time</label>
              <input
                id="start_time"
                disabled={saving}
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
              />

              <label htmlFor="end_time">End Time</label>
              <input
                id="end_time"
                disabled={saving}
                min={form.start_time || undefined}
                type="time"
                name="end_time"
                value={form.end_time}
                onChange={handleChange}
                required
              />

              <button type="submit" disabled={saving || loading}>
                {saving ? "Saving..." : "Add Slot"}
              </button>
            </form>
          </section>

      <section className="patient-section" id="my-slots">
        <h2>My Slots</h2>
        <p className="section-description">Filter your schedule, reuse a time range, or remove unused future slots.</p>
        <div className="admin-appointment-filters">
          <label>Show slots<select value={slotScope} onChange={e => setSlotScope(e.target.value)}><option value="all">All slots</option><option value="available">Available</option><option value="booked">Upcoming booked</option><option value="past">Past slots</option></select></label>
          <label>Date<input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} /></label>
          <button className="admin-secondary" type="button" onClick={() => { setSlotScope("all"); setSlotDate(""); }}>Reset</button>
        </div>
        <p className="section-description" role="status">{visibleSlots.length} of {slots.length} slots</p>
        {loading ? <p>Loading slots...</p> : visibleSlots.length === 0 ? <p>{slots.length ? "No slots match these filters." : "Add your first available slot using the form."}</p> : (
          <div className="appointment-list">
            {visibleSlots.map(slot => (
              <article className="appointment-card" key={slot.id}>
                <div>
                  <h3>{formatDate(slot.slot_date)}</h3>
                  <p>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</p>
                  <span className="status">{Number(slot.is_booked) ? "Booked" : startsAt(slot) > now ? "Available" : "Past slot"}</span>
                </div>
                <div className="doctor-slot-actions"><button type="button" className="admin-secondary" disabled={saving} onClick={() => reuseSlot(slot)}>Reuse times</button>
                {Number(slot.can_delete) === 1 && startsAt(slot) > now && (
                  <ConfirmButton className="cancel-btn" disabled={deletingId !== null}
                    confirmation="Remove this available time?" onConfirm={() => removeSlot(slot.id)}>{deletingId === slot.id ? "Removing..." : "Remove Slot"}</ConfirmButton>
                )}</div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="patient-section" id="clinic-services">
        <h2>Clinic Services</h2>
        <p className="section-description">Add a service to the clinic’s shared catalogue. Services are available across all doctors; patients see times that fit the selected duration.</p>
        <form className="booking-form" onSubmit={addService}>
          <label htmlFor="service-name">Service name</label>
          <input id="service-name" value={serviceForm.name} maxLength={100} required disabled={savingService} placeholder="e.g. Dental X-ray" onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} />
          <label htmlFor="service-duration">Duration (minutes)</label>
          <input id="service-duration" type="number" min="1" max="1440" step="1" value={serviceForm.duration_minutes} required disabled={savingService} onChange={e => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })} />
          <label htmlFor="service-price">Price (JOD)</label>
          <input id="service-price" type="number" min="0" max="999999.99" step="0.01" value={serviceForm.price} required disabled={savingService} onChange={e => setServiceForm({ ...serviceForm, price: e.target.value })} />
          <button type="submit" disabled={savingService || loading}>{savingService ? "Adding service..." : "Add Service"}</button>
        </form>
        <h3 className="service-list-heading">Available services</h3>
        {loading ? <p>Loading services...</p> : services.length === 0 ? <p>No services yet. Add the first service above.</p> : <div className="service-grid">{services.map(service => <article className="service-card" key={service.id}><h3>{service.name}</h3><p>{service.duration_minutes} minutes</p><strong>{Number(service.price).toFixed(2)} <small>JOD</small></strong></article>)}</div>}
      </section>
      <section className="patient-section" id="appointments">
        <h2>My Appointments</h2>
        <p className="section-description">Find your visits by name, service or date.</p>
        <AppointmentTools filters={filters} onChange={setFilters} count={visibleAppointments.length} disabled={loading} />
        <div className="admin-appointment-filters">
          <label>Visits<select value={visitScope} onChange={e => setVisitScope(e.target.value)}><option value="all">All visits</option><option value="today">Today</option><option value="upcoming">Upcoming / in progress</option></select></label>
          <label>Date<input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} /></label>
          <button type="button" className="admin-secondary" onClick={() => { setAppointmentDate(""); setVisitScope("all"); setFilters({ query: "", status: "all" }); }}>Reset all filters</button>
        </div>

        {loading ? (
          <p>Loading appointments...</p>
        ) : visibleAppointments.length === 0 ? (
          <div className="empty-state"><span aria-hidden="true">＋</span><h3>{appointments.length ? "No matching appointments" : "A little breathing room"}</h3><p>{appointments.length ? "Try another search or clear your filters." : "Appointments will appear here once a patient books a visit."}</p></div>
        ) : (
          <div className="appointment-list">
            {visibleAppointments.map(appointment => {
              const start = startsAt(appointment);
              const end = endsAt(appointment);

              const canConfirm =
                appointment.status === "pending" &&
                start > now;

              const canComplete =
                appointment.status === "confirmed" &&
                end <= now;

              return (
                <article className="appointment-card" key={appointment.id}>
                  <div>
                    <h3>{appointment.patient_name}</h3>
                    <p>Service: {appointment.service_name}</p>
                    <p>Date: {formatDate(appointment.slot_date)}</p>
                    <p>
                      Time: {appointment.start_time.slice(0, 5)}
                      {" - "}
                      {appointment.end_time.slice(0, 5)}
                    </p>

                    <span className={`status status-${appointment.status}`}>
                      {appointment.status}
                    </span>
                  </div>

                  <div className="doctor-actions">
                    {canConfirm && (
                      <button
                        disabled={updatingId !== null}
                        onClick={() => updateStatus(appointment.id, "confirmed")}
                      >
                        {updatingId === appointment.id ? "Updating..." : "Confirm"}
                      </button>
                    )}

                    {canComplete && (
                      <button
                        disabled={updatingId !== null}
                        onClick={() => updateStatus(appointment.id, "completed")}
                      >
                        {updatingId === appointment.id ? "Updating..." : "Complete"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
