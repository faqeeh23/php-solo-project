import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "../style/patient.css";
import DoctorResults from "../components/DoctorResults";
import ConfirmButton from "../components/ConfirmButton";
import AppointmentTools from "../components/AppointmentTools";
import { filterAppointments, formatDate } from "../utils/appointments";

export default function Admin() {
  const [doctors, setDoctors] = useState([]);
  const [doctorForm, setDoctorForm] = useState({ name: "", email: "", password: "" });
  const [creatingDoctor, setCreatingDoctor] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [filters, setFilters] = useState({ query: "", status: "all" });
  const [doctorQuery, setDoctorQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [visibleCount, setVisibleCount] = useState(8);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const visibleDoctors = doctors.filter(d => (d.name + " " + d.email).toLowerCase().includes(doctorQuery.trim().toLowerCase()));
  const dateRangeInvalid = !!(fromDate && toDate && fromDate > toDate);
  const visibleAppointments = filterAppointments(appointments, filters)
    .filter(a => !dateRangeInvalid && (!selectedDoctor || String(a.doctor_id) === selectedDoctor)
      && (!fromDate || a.slot_date >= fromDate) && (!toDate || a.slot_date <= toDate))
    .sort((a, b) => (sortOrder === "asc" ? 1 : -1) * (a.slot_date + a.start_time).localeCompare(b.slot_date + b.start_time));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
  const todaysAppointments = appointments.filter(a => a.slot_date === today && a.status !== "cancelled").length;
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    const [doctorData, appointmentData] = await Promise.all([
      apiRequest("admin-doctors"),
      apiRequest("admin-appointments")
    ]);

    setDoctors(doctorData);
    setAppointments(appointmentData);
  }

  useEffect(() => {
    async function initialize() {
      try {
        await loadData();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  function changeDoctorField(event) {
    setDoctorForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  }

  async function addDoctor(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setCreatingDoctor(true);
    try {
      await apiRequest("admin-add-doctor", "POST", doctorForm);
      setDoctorForm({ name: "", email: "", password: "" });
      setMessage("Doctor account created successfully. The doctor can now sign in.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingDoctor(false);
    }
  }

  async function refresh() {
    setRefreshing(true); setError("");
    try { await loadData(); } catch (err) { setError(err.message); }
    finally { setRefreshing(false); }
  }
  async function saveDoctor(event) {
    event.preventDefault(); setSavingDoctor(true); setError(""); setMessage("");
    try {
      await apiRequest("admin-edit-doctor", "POST", { doctor_id: editingDoctor.id, name: editingDoctor.name, email: editingDoctor.email });
      setEditingDoctor(null);
      setMessage("Doctor profile updated. Their email is also their sign-in address.");
      await loadData();
    } catch (err) { setError(err.message); }
    finally { setSavingDoctor(false); }
  }
  function resetAppointmentFilters() {
    setFilters({ query: "", status: "all" }); setSelectedDoctor(""); setFromDate(""); setToDate(""); setSortOrder("asc"); setVisibleCount(8);
  }

  async function updateStatus(id, status) {
    setError("");
    setMessage("");
    setUpdatingId(id);

    try {
      await apiRequest("admin-update", "POST", {
        appointment_id: id,
        status
      });

      setMessage("Appointment updated successfully!");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  const pending = appointments.filter(
    a => a.status === "pending"
  ).length;

  const confirmed = appointments.filter(
    a => a.status === "confirmed"
  ).length;

  return (
    <main className="patient-page admin-dashboard">
      <header className="patient-header">
        <span className="eyebrow">Admin workspace</span>
        <h1>Admin Dashboard</h1>
        <p>Keep your practice moving. Manage your team and oversee every appointment.</p>
      </header>
      <nav className="dashboard-shortcuts" aria-label="Dashboard sections"><a href="#add-doctor">Add a doctor <span aria-hidden="true">↗</span></a><a href="#appointments">Appointments <span aria-hidden="true">↗</span></a><a href="#doctors">Our team <span aria-hidden="true">↗</span></a><a href="#doctor-results">Doctor results <span aria-hidden="true">↗</span></a></nav>

      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      {loading ? (
        <p>Loading dashboard...</p>
      ) : (
        <>
          <section className="patient-section">
            <div className="admin-section-heading"><div><h2>Overview</h2><p className="section-description">Today’s visits use the clinic timezone (Amman).</p></div><button type="button" className="admin-secondary" onClick={refresh} disabled={refreshing || creatingDoctor || savingDoctor || updatingId !== null}>{refreshing ? "Refreshing..." : "Refresh data"}</button></div>

            <div className="service-grid">
              {[
                ["Doctors", doctors.length],
                ["Appointments", appointments.length],
                ["Pending", pending],
                ["Confirmed", confirmed],
                ["Today’s visits", todaysAppointments]
              ].map(([label, value]) => (
                <article className="service-card" key={label}>
                  <h3>{label}</h3>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="patient-section" id="add-doctor">
            <h2>Add Doctor</h2>
            <p className="section-description">Welcome a new member to your team. They can sign in and set their own availability.</p>
            <form className="booking-form" onSubmit={addDoctor}>
              <label htmlFor="doctor-name">Full name</label>
              <input id="doctor-name" name="name" autoComplete="name" maxLength={100}
                value={doctorForm.name} onChange={changeDoctorField} required disabled={creatingDoctor} />
              <label htmlFor="doctor-email">Email</label>
              <input id="doctor-email" name="email" type="email" autoComplete="off" maxLength={150}
                value={doctorForm.email} onChange={changeDoctorField} required disabled={creatingDoctor} />
              <label htmlFor="doctor-password">Password</label>
              <input id="doctor-password" name="password" type="password" autoComplete="new-password"
                minLength={8} maxLength={72} aria-describedby="doctor-password-help"
                value={doctorForm.password} onChange={changeDoctorField} required disabled={creatingDoctor} />
              <small id="doctor-password-help">Use at least 8 characters. Share the login details with the doctor.</small>
              <button type="submit" disabled={creatingDoctor}>
                {creatingDoctor ? "Creating account..." : "Add Doctor"}
              </button>
            </form>
          </section>

          <section className="patient-section" id="doctors">
            <div className="admin-section-heading"><h2>Doctors</h2><span>{visibleDoctors.length} of {doctors.length} doctors</span></div>
            <label className="sr-only" htmlFor="doctor-search">Search doctors</label>
            <input className="admin-search" id="doctor-search" type="search" placeholder="Search doctors by name or email..." value={doctorQuery} onChange={e => setDoctorQuery(e.target.value)} />

            {visibleDoctors.length === 0 ? (
              <p>{doctors.length ? "No doctors match your search." : "Add your first doctor using the form above."}</p>
            ) : (
              <div className="appointment-list">
                {visibleDoctors.map(doctor => (
                  <article className="appointment-card" key={doctor.id}>
                    {editingDoctor?.id === doctor.id ? (
                      <form className="booking-form doctor-edit-form" onSubmit={saveDoctor}>
                        <h3>Edit doctor</h3>
                        <label htmlFor="edit-doctor-name">Full name</label>
                        <input id="edit-doctor-name" value={editingDoctor.name} maxLength={100} required disabled={savingDoctor} onChange={e => setEditingDoctor({ ...editingDoctor, name: e.target.value })} />
                        <label htmlFor="edit-doctor-email">Email / sign-in address</label>
                        <input id="edit-doctor-email" type="email" value={editingDoctor.email} maxLength={150} required disabled={savingDoctor} onChange={e => setEditingDoctor({ ...editingDoctor, email: e.target.value })} />
                        <small>Changing the email also changes how this doctor signs in.</small>
                        <div className="admin-edit-actions"><button className="admin-primary" disabled={savingDoctor}>{savingDoctor ? "Saving..." : "Save changes"}</button><button className="admin-secondary" type="button" disabled={savingDoctor} onClick={() => setEditingDoctor(null)}>Cancel editing</button></div>
                      </form>
                    ) : (
                      <div className="doctor-profile">
                        <h3>{doctor.name}</h3><p>{doctor.email}</p>
                        <div className="doctor-workload"><span><strong>{doctor.available_slots}</strong> available slots</span><span><strong>{doctor.upcoming_appointments}</strong> upcoming visits</span></div>
                        <button type="button" className="admin-secondary" disabled={savingDoctor} onClick={() => setEditingDoctor({ id: doctor.id, name: doctor.name, email: doctor.email })}>Edit profile</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <DoctorResults doctors={doctors} appointments={appointments} onView={(id, from, to) => {
            setSelectedDoctor(id); setFromDate(from); setToDate(to); setFilters({ query: "", status: "all" }); setVisibleCount(8);
            document.getElementById("appointments")?.scrollIntoView({ behavior: "smooth" });
          }} />
          <section className="patient-section" id="appointments">
            <h2>All Appointments</h2>
        <p className="section-description">Find your visits by name, service or date.</p>
        <AppointmentTools filters={filters} onChange={next => { setFilters(next); setVisibleCount(8); }} count={visibleAppointments.length} disabled={loading} />
        <div className="admin-appointment-filters">
          <label>Doctor<select value={selectedDoctor} onChange={e => { setSelectedDoctor(e.target.value); setVisibleCount(8); }}><option value="">All doctors</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>From date<input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setVisibleCount(8); }} /></label>
          <label>To date<input type="date" value={toDate} min={fromDate || undefined} onChange={e => { setToDate(e.target.value); setVisibleCount(8); }} /></label>
          <label>Sort by<select value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option value="asc">Oldest first</option><option value="desc">Newest first</option></select></label>
          <button type="button" className="admin-secondary" onClick={resetAppointmentFilters}>Reset all filters</button>
        </div>
        {dateRangeInvalid && <p className="error-message" role="alert">The end date must be on or after the start date.</p>}

            {visibleAppointments.length === 0 ? (
              <div className="empty-state"><span aria-hidden="true">＋</span><h3>{appointments.length ? "No matching appointments" : "A little breathing room"}</h3><p>{appointments.length ? "Try another search or clear your filters." : "Appointments will appear here once a patient books a visit."}</p></div>
            ) : (
              <div className="appointment-list">
                {visibleAppointments.slice(0, visibleCount).map(appointment => (
                  <article className="appointment-card" key={appointment.id}>
                    <div>
                      <h3>{appointment.patient_name}</h3>
                      <p>Doctor: {appointment.doctor_name}</p>
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

                    {["pending", "confirmed"].includes(appointment.status) && new Date(appointment.slot_date + "T" + appointment.start_time) > new Date() && (
                      <div className="doctor-actions">
                        <ConfirmButton
                          className="cancel-btn"
                          disabled={updatingId !== null}
                          confirmation="Cancel this appointment?" onConfirm={() => updateStatus(appointment.id, "cancelled")}
                        >
                          Cancel
                        </ConfirmButton>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
            {visibleAppointments.length > visibleCount && <div className="admin-more"><p>Showing {visibleCount} of {visibleAppointments.length} appointments</p><button type="button" className="admin-secondary" onClick={() => setVisibleCount(count => count + 8)}>Show 8 more</button></div>}
          </section>
        </>
      )}
    </main>
  );
}
