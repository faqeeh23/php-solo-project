import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "../style/patient.css";

export default function Doctor() {
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ slot_date: "", start_time: "", end_time: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAppointments() {
    const [data, slotData] = await Promise.all([
      apiRequest("doctor-appointments"), apiRequest("doctor-slots")
    ]);
    setAppointments(data);
    setSlots(slotData);
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
            <h2>Add Available Slot</h2>

            <form className="booking-form" onSubmit={handleAddSlot}>
              <label htmlFor="slot_date">Date</label>
              <input
                id="slot_date"
                type="date"
                name="slot_date"
                value={form.slot_date}
                onChange={handleChange}
                required
              />

              <label htmlFor="start_time">Start Time</label>
              <input
                id="start_time"
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
              />

              <label htmlFor="end_time">End Time</label>
              <input
                id="end_time"
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

      <section className="patient-section">
        <h2>My Slots</h2>
        <p>You can remove future slots that have no booking history.</p>
        {loading ? <p>Loading slots...</p> : slots.length === 0 ? <p>No slots found.</p> : (
          <div className="appointment-list">
            {slots.map(slot => (
              <article className="appointment-card" key={slot.id}>
                <div>
                  <h3>{slot.slot_date}</h3>
                  <p>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</p>
                  <span className="status">{Number(slot.is_booked) ? "Booked" : "Unbooked"}</span>
                </div>
                {Number(slot.can_delete) === 1 && (
                  <button className="cancel-btn" disabled={deletingId !== null}
                    onClick={() => removeSlot(slot.id)}>Remove Slot</button>
                )}
              </article>
            ))}
          </div>
        )}
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
