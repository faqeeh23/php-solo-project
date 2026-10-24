<?php

class Admin {
    private PDO $conn;

    public function __construct(PDO $conn) {
        $this->conn = $conn;
    }

    public function getDoctors(): array {
        $sql = "SELECT id, name, email
                FROM users
                WHERE role = 'doctor'
                ORDER BY name";

        return $this->conn->query($sql)->fetchAll();
    }

    public function getAppointments(): array {
        $sql = "SELECT a.id, a.status,
                       p.name AS patient_name,
                       d.name AS doctor_name,
                       sv.name AS service_name,
                       s.slot_date, s.start_time, s.end_time
                FROM appointments a
                JOIN users p ON p.id = a.patient_id
                JOIN services sv ON sv.id = a.service_id
                JOIN appointment_slots s ON s.id = a.slot_id
                JOIN users d ON d.id = s.doctor_id
                ORDER BY s.slot_date DESC, s.start_time DESC";

        return $this->conn->query($sql)->fetchAll();
    }

    public function updateAppointment(
        int $appointmentId,
        string $status
    ): bool {
        if (!in_array($status, ["cancelled"], true)) {
            throw new InvalidArgumentException("Invalid status");
        }

        $sql = "UPDATE appointments
                SET status = :new_status
                WHERE id = :id
                  AND status IN ('pending', 'confirmed') AND EXISTS (SELECT 1 FROM appointment_slots s WHERE s.id = appointments.slot_id AND TIMESTAMP(s.slot_date, s.start_time) > NOW())";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute([
            "new_status" => $status,
            "id" => $appointmentId
        ]);

        return $stmt->rowCount() > 0;
    }
}
