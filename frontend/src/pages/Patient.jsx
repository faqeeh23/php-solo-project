
import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "../services/api";
import "../style/patient.css";
import ConfirmButton from "../components/ConfirmButton";
import AppointmentTools from "../components/AppointmentTools";
import { filterAppointments, formatDate } from "../utils/appointments";

export default function Patient() {
  const [services, setServices] = useState([]);
  const [bookingDay, setBookingDay] = useState("today");
  const [bookingDate, setBookingDate] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const dayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const part = key => dayParts.find(p => p.type === key).value;
  const today = part("year") + "-" + part("month") + "-" + part("day");
  const tomorrowDate = new Date(today + "T12:00:00Z");
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
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

    if (!form.service_id || !selectedSlot) {
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
    if (new Date(slot.starts_at || slot.slot_date + "T" + slot.start_time).getTime() <= now) return false;
    if (!selectedService) return true;

    const duration =
      toMinutes(slot.end_time) - toMinutes(slot.start_time);

    return duration >= Number(selectedService.duration_minutes);
  });

  const targetDate = bookingDay === "today" ? today : bookingDay === "tomorrow" ? tomorrow : bookingDate;
  const daySlots = availableSlots.filter(slot => bookingDay === "all" || slot.slot_date === targetDate)
    .sort((a, b) => (a.slot_date + a.start_time).localeCompare(b.slot_date + b.start_time));
  const selectedSlot = daySlots.find(slot => String(slot.id) === form.slot_id);
  function changeBookingDay(day) {
    setBookingDay(day);
    setForm(previous => ({ ...previous, slot_id: "" }));
  }

  // Check whether cancellation is allowed
  function canCancel(appointment) {
    const validStatus = ["pending", "confirmed"].includes(
      appointment.status
    );

    const appointmentDate = new Date(
      appointment.starts_at || `${appointment.slot_date}T${appointment.start_time}`
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

          <div className="booking-day-picker" role="group" aria-label="Choose appointment day">
            {[["today", "Today", today], ["tomorrow", "Tomorrow", tomorrow], ["all", "Any day", null]].map(([key, title, date]) => (
              <button key={key} type="button" aria-pressed={bookingDay === key} disabled={loading || fetching} onClick={() => changeBookingDay(key)}>
                <strong>{title}</strong><span>{date ? formatDate(date) : "All upcoming dates"}</span><small>{fetching ? "Loading..." : availableSlots.filter(slot => !date || slot.slot_date === date).length + " available"}</small>
              </button>
            ))}
          </div>
          <label htmlFor="booking-date">Or choose a date</label>
          <input id="booking-date" type="date" min={today} value={bookingDate} disabled={loading || fetching} onChange={e => { setBookingDate(e.target.value); changeBookingDay(e.target.value ? "custom" : "today"); }} />
          {!form.service_id && <p className="field-hint">Browse available times below. Select a service above to choose your appointment.</p>}
          <fieldset className="booking-times" disabled={!form.service_id || loading || fetching}>
            <legend>{bookingDay === "all" ? "Available appointments" : targetDate ? "Available times · " + formatDate(targetDate) : "Available times"}</legend>
            {fetching ? <p role="status">Loading available times...</p> : daySlots.length ? <div className="time-option-grid">{daySlots.map(slot => (
              <label className={"time-option" + (form.slot_id === String(slot.id) ? " is-selected" : "")} key={slot.id}>
                <input type="radio" name="slot_id" value={slot.id} checked={form.slot_id === String(slot.id)} required onChange={() => setForm(previous => ({ ...previous, slot_id: String(slot.id) }))} />
                <span><strong>{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</strong><span>{slot.doctor_name}</span>{bookingDay === "all" && <small>{formatDate(slot.slot_date)}</small>}</span>
              </label>
            ))}</div> : <div className="booking-no-times"><strong>No available times {bookingDay === "today" ? "today" : bookingDay === "tomorrow" ? "tomorrow" : "for this selection"}.</strong><p>{availableSlots.length ? "Try another day to find a time that works for you." : "Please check back later for new availability."}</p></div>}
          </fieldset>
          {!fetching && daySlots.length === 0 && availableSlots.length > 0 && bookingDay !== "all" && <button className="browse-times-button" type="button" onClick={() => changeBookingDay("all")}>See next available times →</button>}
          <p className="availability-note" role="status">{!fetching && daySlots.length + (daySlots.length === 1 ? " time available" : " times available")} · Clinic time (Amman)</p>

          {selectedService && <div className="booking-summary"><span>Your visit</span><strong>{selectedService.name}</strong><p>{selectedService.duration_minutes} minutes · {Number(selectedService.price).toFixed(2)} JOD</p>{selectedSlot && <p><strong>{selectedSlot.doctor_name}</strong><br />{formatDate(selectedSlot.slot_date)} · {selectedSlot.start_time.slice(0, 5)} – {selectedSlot.end_time.slice(0, 5)}</p>}</div>}
          <button
            type="submit"
            disabled={
              loading ||
              fetching ||
              !form.service_id ||
              !selectedSlot
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
