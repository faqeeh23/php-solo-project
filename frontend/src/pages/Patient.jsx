
import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "../services/api";
import "../style/patient.css";
import ConfirmButton from "../components/ConfirmButton";
import AppointmentTools from "../components/AppointmentTools";
import { filterAppointments, formatDate } from "../utils/appointments";

export default function Patient() {
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [filters, setFilters] = useState({ query: "", status: "all" });
  const visibleAppointments = filterAppointments(appointments, filters);

  const [form, setForm] = useState({
    service_id: "",
    slot_id: ""
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Convert time (09:30:00) to total minutes
  function toMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  // Fetch data independently so one failed request
  // does not prevent other sections from loading
  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      apiRequest("services"),
      apiRequest("slots"),
      apiRequest("my-appointments")
    ]);

    const [servicesResult, slotsResult, appointmentsResult] = results;
    const errors = [];

    if (servicesResult.status === "fulfilled") {
      setServices(servicesResult.value);
    } else {
      console.error("Services Error:", servicesResult.reason);
      errors.push("Could not load services.");
    }

    if (slotsResult.status === "fulfilled") {
      setSlots(slotsResult.value);
    } else {
      console.error("Slots Error:", slotsResult.reason);
      errors.push("Could not load available appointments.");
    }

    if (appointmentsResult.status === "fulfilled") {
      setAppointments(appointmentsResult.value);
    } else {
      console.error("Appointments Error:", appointmentsResult.reason);
      errors.push("Could not load your appointments. Please login again.");
    }

    setError(errors.join(" "));
  }, []);

  // Load data when the page opens
  useEffect(() => {
    async function initialize() {
      setFetching(true);

      try {
        await loadData();
      } finally {
        setFetching(false);
      }
    }

    initialize();
  }, [loadData]);

  // Book an appointment
  async function handleBook(e) {
    e.preventDefault();

    if (!form.service_id || !form.slot_id) {
      setError("Please select a service and appointment time.");
      return;
    }

    setMessage("");
    setError("");
    setLoading(true);

    try {
      await apiRequest("book", "POST", {
        service_id: Number(form.service_id),
        slot_id: Number(form.slot_id)
      });

      setMessage("Appointment booked successfully!");
      setForm({ service_id: "", slot_id: "" });

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Cancel an appointment
  async function handleCancel(id) {
    setMessage("");
    setError("");
    setCancellingId(id);

    try {
      await apiRequest("cancel", "POST", {
        appointment_id: id
      });

      setMessage("Appointment cancelled successfully!");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  // Find selected service
  const selectedService = services.find(
    service => String(service.id) === form.service_id
  );

  // Only display slots that fit the selected service duration
  const availableSlots = slots.filter(slot => {
    if (!selectedService) return true;

    const duration =
      toMinutes(slot.end_time) - toMinutes(slot.start_time);

    return duration >= Number(selectedService.duration_minutes);
  });

  // Check whether cancellation is allowed
  function canCancel(appointment) {
    const validStatus = ["pending", "confirmed"].includes(
      appointment.status
    );

    const appointmentDate = new Date(
      `${formatDate(appointment.slot_date)}T${appointment.start_time}`
    );

    return validStatus && appointmentDate > new Date();
  }

  return (
    <main className="patient-page patient-dashboard">
      <header className="patient-header">
        <span className="eyebrow">Patient workspace</span>
        <div>
          <h1>Patient Dashboard</h1>
          <p>Your next healthy smile starts here. Book a visit and keep track of your care.</p>
        </div>
      </header>
      <nav className="dashboard-shortcuts" aria-label="Dashboard sections"><a href="#book-appointment">Book a visit <span aria-hidden="true">↗</span></a><a href="#appointments">My appointments <span aria-hidden="true">↗</span></a><a href="#services">Explore services <span aria-hidden="true">↗</span></a></nav>

      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {fetching && <p>Loading appointments...</p>}

      {/* Dental Services */}
      <section className="patient-section" id="services">
        <h2>Our Dental Services</h2>

        <div className="service-grid">
          {services.map(service => (
            <article className="service-card" key={service.id}>
              <h3>{service.name}</h3>
              <p>{service.duration_minutes} minutes</p>
              <strong>{Number(service.price).toFixed(2)} <small>JOD</small></strong>
              <button type="button" className="service-select" disabled={loading || fetching} onClick={() => { setForm({ service_id: String(service.id), slot_id: "" }); document.getElementById("book-appointment")?.scrollIntoView({ behavior: "smooth" }); }}>
                {String(service.id) === form.service_id ? "Selected ✓" : "Choose this service →"}
              </button>
            </article>
          ))}
        </div>

        {!fetching && services.length === 0 && (
          <p>No services available.</p>
        )}
      </section>

      {/* Book Appointment */}
      <section className="patient-section" id="book-appointment">
        <h2>Book an Appointment</h2>
        <p className="section-description">Choose your service first. We’ll show times that fit your visit.</p>

        <form className="booking-form" onSubmit={handleBook}>
          <label htmlFor="service">Select Service</label>

          <select
            id="service"
            disabled={fetching || loading}
            value={form.service_id}
            onChange={e =>
              setForm({
                service_id: e.target.value,
                slot_id: ""
              })
            }
            required
          >
            <option value="">Choose a service</option>

            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name} — {service.price} JOD
              </option>
            ))}
          </select>

          <label htmlFor="slot">Select Doctor & Time</label>

          <select
            id="slot"
            value={form.slot_id}
            onChange={e =>
              setForm(prev => ({
                ...prev,
                slot_id: e.target.value
              }))
            }
            disabled={!form.service_id || fetching || loading}
            required
          >
            <option value="">Choose an available time</option>

            {availableSlots.map(slot => (
              <option key={slot.id} value={slot.id}>
                {slot.doctor_name} — {slot.slot_date} —{" "}
                {slot.start_time.slice(0, 5)} to{" "}
                {slot.end_time.slice(0, 5)}
              </option>
            ))}
          </select>

          {form.service_id && availableSlots.length === 0 && (
            <p className="error-message">
              No available appointments for this service.
            </p>
          )}

          {selectedService && <div className="booking-summary"><span>Your visit</span><strong>{selectedService.name}</strong><p>{selectedService.duration_minutes} minutes · {Number(selectedService.price).toFixed(2)} JOD</p></div>}
          <button
            type="submit"
            disabled={
              loading ||
              fetching ||
              !form.service_id ||
              !form.slot_id
            }
          >
            {loading ? "Booking..." : "Book Appointment"}
          </button>
        </form>
      </section>

      {/* My Appointments */}
      <section className="patient-section" id="appointments">
        <h2>My Appointments</h2>
        <p className="section-description">Find your visits by name, service or date.</p>
        <AppointmentTools filters={filters} onChange={setFilters} count={visibleAppointments.length} disabled={fetching} />

        {fetching ? <p className="loading-state" role="status">Loading your appointments...</p> : visibleAppointments.length === 0 ? (
          <div className="empty-state"><span aria-hidden="true">＋</span><h3>{appointments.length ? "No matching appointments" : "Your next visit starts here"}</h3><p>{appointments.length ? "Try another search or clear your filters." : "Choose a service and an available time for your first appointment."}</p><a href="#book-appointment">Find an appointment →</a></div>
        ) : (
          <div className="appointment-list">
            {visibleAppointments.map(appointment => (
              <article
                className="appointment-card"
                key={appointment.id}
              >
                <div>
                  <h3>{appointment.service_name}</h3>

                  <p>Doctor: {appointment.doctor_name}</p>

                  <p>
                    Date: {formatDate(appointment.slot_date)}
                  </p>

                  <p>
                    Time: {appointment.start_time.slice(0, 5)}
                    {" - "}
                    {appointment.end_time.slice(0, 5)}
                  </p>

                  <span
                    className={`status status-${appointment.status}`}
                  >
                    {appointment.status}
                  </span>
                </div>

                {canCancel(appointment) && (
                  <ConfirmButton
                    type="button"
                    className="cancel-btn"
                    disabled={cancellingId !== null}
                    confirmation="Cancel this appointment?" onConfirm={() => handleCancel(appointment.id)}
                  >
                    {cancellingId === appointment.id
                      ? "Cancelling..."
                      : "Cancel Appointment"}
                  </ConfirmButton>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
