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

    public function addSlot(
        int $doctorId,
        string $date,
        string $startTime,
        string $endTime
    ): bool {
        $start = DateTimeImmutable::createFromFormat(
            '!Y-m-d H:i',
            "$date $startTime"
        );

        $end = DateTimeImmutable::createFromFormat(
            '!Y-m-d H:i',
            "$date $endTime"
        );

        if (!$start || !$end || $start->format("Y-m-d H:i") !== "$date $startTime" || $end->format("Y-m-d H:i") !== "$date $endTime" || $start <= new DateTimeImmutable() || $end <= $start) {
            throw new InvalidArgumentException("Invalid appointment time");
        }

        $this->conn->beginTransaction();

        try {
            // Lock the doctor record to serialize slot creation.
            $stmt = $this->conn->prepare(
                "SELECT id FROM users
                 WHERE id = :id AND role = 'doctor'
                 FOR UPDATE"
            );
            $stmt->execute(["id" => $doctorId]);

            if (!$stmt->fetch()) {
                throw new InvalidArgumentException("Doctor not found");
            }

            $stmt = $this->conn->prepare(
                "SELECT COUNT(*) FROM appointment_slots
                 WHERE doctor_id = :doctor_id
                   AND slot_date = :slot_date
                   AND start_time < :end_time
                   AND end_time > :start_time"
            );

            $stmt->execute([
                "doctor_id" => $doctorId,
                "slot_date" => $date,
                "start_time" => $startTime,
                "end_time" => $endTime
            ]);

            if ((int)$stmt->fetchColumn() > 0) {
                throw new InvalidArgumentException("Slot overlaps another slot");
            }

            $stmt = $this->conn->prepare(
                "INSERT INTO appointment_slots
                 (doctor_id, slot_date, start_time, end_time)
                 VALUES (:doctor_id, :slot_date, :start_time, :end_time)"
            );

            $saved = $stmt->execute([
                "doctor_id" => $doctorId,
                "slot_date" => $date,
                "start_time" => $startTime,
                "end_time" => $endTime
            ]);

            $this->conn->commit();
            return $saved;
        } catch (Throwable $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function updateAppointment(
        int $appointmentId,
        string $status
    ): bool {
        if (!in_array($status, ["confirmed", "cancelled"], true)) {
            throw new InvalidArgumentException("Invalid status");
        }

        $sql = "UPDATE appointments
                SET status = :new_status
                WHERE id = :id
                  AND status = 'pending'";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute([
            "new_status" => $status,
            "id" => $appointmentId
        ]);

        return $stmt->rowCount() > 0;
    }
}
