export function filterAppointments(appointments, filters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return appointments.filter(a => (filters.status === "all" || a.status === filters.status) &&
    [a.patient_name, a.doctor_name, a.service_name, a.slot_date, a.slot_date ? formatDate(a.slot_date) : ""].filter(Boolean).join(" ").toLocaleLowerCase().includes(query));
}
export function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value + "T12:00:00"));
}
