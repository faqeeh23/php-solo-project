<?php
class Appointment {
    private PDO $conn ;

    public function __construct(PDO $conn) {
        $this->conn = $conn;

    }

    public function getAvailableSlots() :array {
        $sql = "SELECT s.id, s.doctor_id, u.name AS doctor_name,
                       s.slot_date, s.start_time, s.end_time
                FROM appointment_slots s
                JOIN users u ON s.doctor_id = u.id
                WHERE u.role = 'doctor'
                  AND TIMESTAMP(s.slot_date, s.start_time) > NOW()
                  AND NOT EXISTS (
                      SELECT 1 FROM appointments a
                      WHERE a.slot_id = s.id
                        AND a.status <> 'cancelled'
                  )
                ORDER BY s.slot_date, s.start_time";

                return $this->conn->query($sql)->fetchAll();
    }

    public function getServices(): array {
    return $this->conn->query("SELECT * FROM services ORDER BY id")->fetchAll();
}

    public function book(int $patientId , int $serviceId, int $slotId) : bool {
        $sql = "SELECT s.id, s.slot_date, s.start_time, s.end_time,
                       sv.duration_minutes
                FROM appointment_slots s
                JOIN users u ON u.id = s.doctor_id
                JOIN services sv ON sv.id = :service_id
                WHERE s.id = :slot_id AND u.role = 'doctor'";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            "service_id" => $serviceId,
            "slot_id" => $slotId
        ]);

        $slot = $stmt->fetch();

        if (!$slot) {
            throw new InvalidArgumentException("Invalid slot or service");

        }

        $start = new DateTimeImmutable($slot["slot_date"] . " " . $slot["start_time"]);

        $end = new DateTimeImmutable($slot["slot_date"] . " " . $slot["end_time"]);

         if ($start <= new DateTimeImmutable()) {
            throw new InvalidArgumentException("Slot is in the past");
        }

        $duration = ($end->getTimestamp() - $start->getTimestamp()) / 60;

        if ($duration < (int)$slot["duration_minutes"]) {
            throw new InvalidArgumentException("Slot is too short for this service");
        }

        $sql = "INSERT INTO appointments (patient_id, service_id, slot_id)
                VALUES (:patient_id, :service_id, :slot_id)";

        $stmt = $this->conn->prepare($sql);

        return $stmt->execute([
            "patient_id" => $patientId,
            "service_id" => $serviceId,
            "slot_id" => $slotId
        ]);
    }

    public function getByPatient(int $patientId): array {
        $sql = "SELECT a.id, a.status, a.created_at,
                       sv.name AS service_name,
                       u.name AS doctor_name,
                       s.slot_date, s.start_time, s.end_time
                FROM appointments a
                JOIN services sv ON sv.id = a.service_id
                JOIN appointment_slots s ON s.id = a.slot_id
                JOIN users u ON u.id = s.doctor_id
                WHERE a.patient_id = :patient_id
                ORDER BY s.slot_date DESC, s.start_time DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute(["patient_id" => $patientId]);

        return $stmt->fetchAll();
    }

    public function cancel(int $appointmentId, int $patientId): bool {
        $sql = "UPDATE appointments
                SET status = 'cancelled'
                WHERE id = :id
                  AND patient_id = :patient_id
                  AND status IN ('pending', 'confirmed')
                  AND EXISTS (
                      SELECT 1 FROM appointment_slots s
                      WHERE s.id = appointments.slot_id
                        AND TIMESTAMP(s.slot_date, s.start_time) > NOW()
                  )";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            "id" => $appointmentId,
            "patient_id" => $patientId
        ]);

        return $stmt->rowCount() > 0;
    }

public function getByDoctor(int $doctorId): array {
    $sql = "SELECT a.id, a.status,
                   p.name AS patient_name,
                   sv.name AS service_name,
                   s.slot_date, s.start_time, s.end_time
            FROM appointments a
            JOIN users p ON p.id = a.patient_id
            JOIN services sv ON sv.id = a.service_id
            JOIN appointment_slots s ON s.id = a.slot_id
            WHERE s.doctor_id = :doctor_id
            ORDER BY s.slot_date DESC, s.start_time DESC";

    $stmt = $this->conn->prepare($sql);
    $stmt->execute(["doctor_id" => $doctorId]);

    return $stmt->fetchAll();
}

public function updateDoctorStatus(
    int $appointmentId,
    int $doctorId,
    string $status
): bool {
    if (!in_array($status, ["confirmed", "completed"], true)) {
        throw new InvalidArgumentException("Invalid status");
    }

    $sql = "UPDATE appointments a
            JOIN appointment_slots s ON s.id = a.slot_id
            SET a.status = :new_status
            WHERE a.id = :appointment_id
              AND s.doctor_id = :doctor_id
              AND (
                  (a.status = 'pending'
                   AND :check_confirm = 'confirmed'
                   AND TIMESTAMP(s.slot_date, s.start_time) > NOW())
                  OR
                  (a.status = 'confirmed'
                   AND :check_complete = 'completed'
                   AND TIMESTAMP(s.slot_date, s.end_time) <= NOW())
              )";

    $stmt = $this->conn->prepare($sql);

    $stmt->execute([
        "new_status" => $status,
        "appointment_id" => $appointmentId,
        "doctor_id" => $doctorId,
        "check_confirm" => $status,
        "check_complete" => $status
    ]);

    return $stmt->rowCount() > 0;
}
}