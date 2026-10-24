import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "../style/patient.css";
import ConfirmButton from "../components/ConfirmButton";
import AppointmentTools from "../components/AppointmentTools";
import { filterAppointments, formatDate } from "../utils/appointments";

export default function Admin() {
  const [doctors, setDoctors] = useState([]);
  const [doctorForm, setDoctorForm] = useState({ name: "", email: "", password: "" });
  const [creatingDoctor, setCreatingDoctor] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [filters, setFilters] = useState({ query: "", status: "all" });
  const visibleAppointments = filterAppointments(appointments, filters);
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
      <nav className="dashboard-shortcuts" aria-label="Dashboard sections"><a href="#add-doctor">Add a doctor <span aria-hidden="true">↗</span></a><a href="#appointments">Appointments <span aria-hidden="true">↗</span></a><a href="#doctors">Our team <span aria-hidden="true">↗</span></a></nav>

      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      {loading ? (
        <p>Loading dashboard...</p>
      ) : (
        <>
          <section className="patient-section">
            <h2>Overview</h2>

            <div className="service-grid">
              {[
                ["Doctors", doctors.length],
                ["Appointments", appointments.length],
                ["Pending", pending],
                ["Confirmed", confirmed]
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
            <h2>Doctors</h2>

            {doctors.length === 0 ? (
              <p>No doctors found.</p>
            ) : (
              <div className="appointment-list">
                {doctors.map(doctor => (
                  <article className="appointment-card" key={doctor.id}>
                    <div>
                      <h3>{doctor.name}</h3>
                      <p>{doctor.email}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="patient-section" id="appointments">
            <h2>All Appointments</h2>
        <p className="section-description">Find your visits by name, service or date.</p>
        <AppointmentTools filters={filters} onChange={setFilters} count={visibleAppointments.length} disabled={loading} />

            {visibleAppointments.length === 0 ? (
              <div className="empty-state"><span aria-hidden="true">＋</span><h3>{appointments.length ? "No matching appointments" : "A little breathing room"}</h3><p>{appointments.length ? "Try another search or clear your filters." : "Appointments will appear here once a patient books a visit."}</p></div>
            ) : (
              <div className="appointment-list">
                {visibleAppointments.map(appointment => (
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
          </section>
        </>
      )}
    </main>
  );
}
