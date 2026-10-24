import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "../style/patient.css";

export default function Doctor() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAppointments() {
    const data = await apiRequest("doctor-appointments");
    setAppointments(data);
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
    <main className="patient-page">
      <header className="patient-header">
        <h1>Doctor Dashboard</h1>
        <p>Manage your patients and appointments</p>
      </header>

      {message && <p role="status" className="success-message">{message}</p>}
      {error && <p role="alert" className="error-message">{error}</p>}

      <section className="patient-section">
        <h2>Appointment Overview</h2>

        <div className="service-grid">
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

      <section className="patient-section">
        <h2>My Appointments</h2>

        {loading ? (
          <p>Loading appointments...</p>
        ) : appointments.length === 0 ? (
          <p>No appointments found.</p>
        ) : (
          <div className="appointment-list">
            {appointments.map(appointment => {
              const start = `${appointment.slot_date}T${appointment.start_time}`;
              const end = `${appointment.slot_date}T${appointment.end_time}`;

              const canConfirm =
                appointment.status === "pending" &&
                new Date(start) > new Date();

              const canComplete =
                appointment.status === "confirmed" &&
                new Date(end) <= new Date();

              return (
                <article className="appointment-card" key={appointment.id}>
                  <div>
                    <h3>{appointment.patient_name}</h3>
                    <p>Service: {appointment.service_name}</p>
                    <p>Date: {appointment.slot_date}</p>
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
                        Confirm
                      </button>
                    )}

                    {canComplete && (
                      <button
                        disabled={updatingId !== null}
                        onClick={() => updateStatus(appointment.id, "completed")}
                      >
                        Complete
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
