<?php

class Admin {
    private PDO $conn;

    public function __construct(PDO $conn) {
        $this->conn = $conn;
    }

    public function addDoctor(string $name, string $email, string $password): bool {
        $name = trim($name);
        $email = trim($email);
        if ($name === "" || mb_strlen($name) > 100 || strlen($email) > 150
            || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 72) {
            throw new InvalidArgumentException("Enter a name, a valid email, and a password of 8 to 72 bytes");
        }
        $stmt = $this->conn->prepare("INSERT INTO users (name, email, password, role)
            VALUES (:name, :email, :password, 'doctor')");
        return $stmt->execute([
            "name" => $name,
            "email" => $email,
            "password" => password_hash($password, PASSWORD_DEFAULT)
        ]);
    }

    public function updateDoctor(int $doctorId, string $name, string $email): bool {
        $name = trim($name);
        $email = trim($email);
        if ($name === "" || mb_strlen($name) > 100 || strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("Enter a name and valid email address");
        }
        $stmt = $this->conn->prepare("SELECT name, email FROM users WHERE id = :id AND role = 'doctor'");
        $stmt->execute(["id" => $doctorId]);
        $doctor = $stmt->fetch();
        if (!$doctor) { return false; }
        if ($doctor["name"] === $name && $doctor["email"] === $email) { return true; }
        $stmt = $this->conn->prepare("UPDATE users SET name = :name, email = :email WHERE id = :id AND role = 'doctor'");
        $stmt->execute(["name" => $name, "email" => $email, "id" => $doctorId]);
        return $stmt->rowCount() > 0;
    }

    public function getDoctors(): array {
        $sql = "SELECT id, name, email,
                    (SELECT COUNT(*) FROM appointment_slots s WHERE s.doctor_id = users.id
                        AND TIMESTAMP(s.slot_date, s.start_time) > NOW()
                        AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id AND a.status <> 'cancelled')) AS available_slots,
                    (SELECT COUNT(*) FROM appointments a JOIN appointment_slots s ON s.id = a.slot_id
                        WHERE s.doctor_id = users.id AND a.status IN ('pending', 'confirmed')
                        AND TIMESTAMP(s.slot_date, s.start_time) > NOW()) AS upcoming_appointments
                FROM users
                WHERE role = 'doctor'
                ORDER BY name";

        return $this->conn->query($sql)->fetchAll();
    }

    public function getAppointments(): array {
        $sql = "SELECT a.id, a.status, s.doctor_id,
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
