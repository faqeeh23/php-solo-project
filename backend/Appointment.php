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

                return $this->withSlotTimestamps($this->conn->query($sql)->fetchAll());
    }

    public function addService(string $name, int $duration, string $price): bool {
        $name = trim($name);
        if ($name === "" || mb_strlen($name) > 100 || $duration < 1 || $duration > 1440
            || !preg_match('/^\d{1,6}(\.\d{1,2})?$/', $price)) {
            throw new InvalidArgumentException("Enter a service name, duration of 1–1440 minutes, and price from 0 to 999999.99 with at most 2 decimals");
        }
        $stmt = $this->conn->prepare("INSERT INTO services (name, duration_minutes, price) VALUES (:name, :duration, :price)");
        return $stmt->execute(["name" => $name, "duration" => $duration, "price" => $price]);
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

        return $this->withSlotTimestamps($stmt->fetchAll());
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
                   sv.name AS service_name, sv.price AS service_price,
                   s.slot_date, s.start_time, s.end_time
            FROM appointments a
            JOIN users p ON p.id = a.patient_id
            JOIN services sv ON sv.id = a.service_id
            JOIN appointment_slots s ON s.id = a.slot_id
            WHERE s.doctor_id = :doctor_id
            ORDER BY s.slot_date DESC, s.start_time DESC";

    $stmt = $this->conn->prepare($sql);
    $stmt->execute(["doctor_id" => $doctorId]);

    return $this->withSlotTimestamps($stmt->fetchAll());
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


    private function withSlotTimestamps(array $rows): array {
        foreach ($rows as &$row) {
            $row["starts_at"] = (new DateTimeImmutable($row["slot_date"] . " " . $row["start_time"]))->format(DATE_ATOM);
            $row["ends_at"] = (new DateTimeImmutable($row["slot_date"] . " " . $row["end_time"]))->format(DATE_ATOM);
        }
        unset($row);
        return $rows;
    }

    public function getDoctorSlots(int $doctorId): array {
        $stmt = $this->conn->prepare("SELECT s.id, s.slot_date, s.start_time, s.end_time,
            EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id AND a.status <> 'cancelled') AS is_booked,
            (TIMESTAMP(s.slot_date, s.start_time) > NOW() AND NOT EXISTS
                (SELECT 1 FROM appointments a WHERE a.slot_id = s.id)) AS can_delete
            FROM appointment_slots s WHERE s.doctor_id = :doctor_id
            ORDER BY s.slot_date DESC, s.start_time DESC");
        $stmt->execute(["doctor_id" => $doctorId]);
        return $this->withSlotTimestamps($stmt->fetchAll());
    }

    public function deleteDoctorSlot(int $slotId, int $doctorId): bool {
        $stmt = $this->conn->prepare("DELETE FROM appointment_slots
            WHERE id = :id AND doctor_id = :doctor_id
              AND TIMESTAMP(slot_date, start_time) > NOW()
              AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = appointment_slots.id)");
        try {
            $stmt->execute(["id" => $slotId, "doctor_id" => $doctorId]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? null) === 1451) { return false; }
            throw $e;
        }
        return $stmt->rowCount() > 0;
    }
}