import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "../style/patient.css";

export default function Admin() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
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
    <main className="patient-page">
      <header className="patient-header">
        <h1>Admin Dashboard</h1>
        <p>Monitor doctors and appointments</p>
      </header>

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

          <section className="patient-section">
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

          <section className="patient-section">
            <h2>All Appointments</h2>

            {appointments.length === 0 ? (
              <p>No appointments found.</p>
            ) : (
              <div className="appointment-list">
                {appointments.map(appointment => (
                  <article className="appointment-card" key={appointment.id}>
                    <div>
                      <h3>{appointment.patient_name}</h3>
                      <p>Doctor: {appointment.doctor_name}</p>
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

                    {["pending", "confirmed"].includes(appointment.status) && new Date(appointment.slot_date + "T" + appointment.start_time) > new Date() && (
                      <div className="doctor-actions">
                        <button
                          className="cancel-btn"
                          disabled={updatingId !== null}
                          onClick={() => updateStatus(appointment.id, "cancelled")}
                        >
                          Cancel
                        </button>
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
