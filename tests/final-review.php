<?php
// CLI-only integration checks. Temporary fixtures are removed in finally blocks.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../backend/Database.php';
$db = (new Database())->connect();
$originalDatabase = $db->query('SELECT DATABASE()')->fetchColumn();
$prefix = 'review_' . bin2hex(random_bytes(6));
$tempDatabase = 'dental_' . $prefix;
$api = getenv('REVIEW_API_URL') ?: 'http://localhost/xampp/php-solo-project/backend/api.php';
$clients = [];
$emails = [];
$passed = 0;
function check(bool $ok, string $label): void {
    global $passed;
    if (!$ok) { throw new RuntimeException($label); }
    $passed++;
    echo "PASS: $label\n";
}
function rejectSql(PDO $db, string $sql, int $code, string $label): void {
    try { $db->exec($sql); }
    catch (PDOException $e) { check((int)($e->errorInfo[1] ?? 0) === $code, $label); return; }
    throw new RuntimeException($label . ': query was accepted');
}
function client() {
    global $clients;
    $c = curl_init();
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEFILE => '', CURLOPT_TIMEOUT => 15]);
    $clients[] = $c;
    return $c;
}
function request($c, string $action, ?array $data = null, ?string $token = null): array {
    global $api;
    curl_setopt($c, CURLOPT_URL, $api . '?action=' . rawurlencode($action));
    $headers = ['Content-Type: application/json'];
    if ($token !== null) { $headers[] = 'X-CSRF-Token: ' . $token; }
    curl_setopt($c, CURLOPT_HTTPHEADER, $headers);
    if ($data !== null) {
        curl_setopt($c, CURLOPT_POST, true);
        curl_setopt($c, CURLOPT_POSTFIELDS, json_encode($data));
    } else { curl_setopt($c, CURLOPT_HTTPGET, true); }
    $body = curl_exec($c);
    if ($body === false) { throw new RuntimeException(curl_error($c)); }
    $json = json_decode($body, true);
    if (!is_array($json)) { throw new RuntimeException('Non-JSON response for ' . $action); }
    return [(int)curl_getinfo($c, CURLINFO_HTTP_CODE), $json];
}
function mutate($c, string $action, array $data = []): array {
    $token = request($c, 'csrf-token')[1]['csrf_token'];
    return request($c, $action, $data, $token);
}
function userId(PDO $db, string $email): int {
    $s = $db->prepare('SELECT id FROM users WHERE email = ?'); $s->execute([$email]);
    return (int)$s->fetchColumn();
}
try {
    $db->exec("CREATE DATABASE `$tempDatabase` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    try {
        $db->exec("USE `$tempDatabase`");
        $db->exec(file_get_contents(__DIR__ . '/../database/schema.sql'));
        $db->exec(file_get_contents(__DIR__ . '/../database/seed.sql'));
        check(count($db->query('SHOW TABLES')->fetchAll()) === 4, 'Fresh schema imports with four tables');
        $db->exec("INSERT INTO users(name,email,password,role) VALUES ('Doctor','d@example.test','fixture','doctor'),('Patient','p@example.test','fixture','patient')");
        $db->exec("INSERT INTO appointment_slots(doctor_id,slot_date,start_time,end_time) VALUES(1,'2030-01-01','09:00','10:00')");
        $db->exec('INSERT INTO appointments(patient_id,service_id,slot_id) VALUES(2,1,1)');
        rejectSql($db, 'INSERT INTO appointments(patient_id,service_id,slot_id) VALUES(2,1,1)', 1062, 'Unique index rejects a second active booking');
        rejectSql($db, 'INSERT INTO appointments(patient_id,service_id,slot_id) VALUES(999,1,999)', 1452, 'Foreign key rejects missing patient');
        $db->exec("UPDATE appointments SET status='cancelled' WHERE id=1");
        $db->exec('INSERT INTO appointments(patient_id,service_id,slot_id) VALUES(2,1,1)');
        check((int)$db->query('SELECT COUNT(*) FROM appointments')->fetchColumn() === 2, 'Rebooking preserves cancelled history');
        check((int)$db->query('SELECT COUNT(*) FROM appointments WHERE active_slot_id IS NULL')->fetchColumn() === 1, 'Generated column is NULL for cancelled bookings');
        try { $db->exec("INSERT INTO services(name,duration_minutes,price) VALUES('Invalid',0,-1)"); throw new RuntimeException('CHECK accepted invalid service'); }
        catch (PDOException $e) { check(true, 'Service CHECK constraints enforced'); }
        try { $db->exec("INSERT INTO appointment_slots(doctor_id,slot_date,start_time,end_time) VALUES(1,'2030-01-02','10:00','09:00')"); throw new RuntimeException('CHECK accepted invalid time'); }
        catch (PDOException $e) { check(true, 'Slot CHECK constraint enforced'); }
    } finally {
        $db->exec('USE `' . str_replace('`', '``', $originalDatabase) . '`');
        $db->exec("DROP DATABASE `$tempDatabase`");
    }
    $guest = client();
    check(request($guest, 'me')[0] === 401, 'Guest session rejected');
    foreach (['register','login','logout','book','cancel','doctor-add-slot','doctor-delete-slot','doctor-update','admin-add-doctor','admin-update'] as $action) {
        $result = request($guest, $action, []);
        check($result[0] === 403 && $result[1]['error'] === 'Invalid CSRF token', 'Missing CSRF rejected: ' . $action);
    }
    $otherSession = client();
    $foreignToken = request($otherSession, 'csrf-token')[1]['csrf_token'];
    check(request($guest, 'logout', [], $foreignToken)[0] === 403, 'Token from another session rejected');
    check(request($guest, 'logout', [], 'invalid')[0] === 403, 'Invalid CSRF rejected');
    check(mutate($guest, 'doctor-add-slot', [])[0] === 403, 'Valid CSRF does not bypass role authorization');

    $password = bin2hex(random_bytes(16));
    $adminEmail = $prefix . '-admin@example.test'; $emails[] = $adminEmail;
    $s = $db->prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)');
    $s->execute(['Review Admin', $adminEmail, password_hash($password, PASSWORD_DEFAULT), 'admin']);
    $admin = client();
    check(mutate($admin, 'login', ['email' => $adminEmail, 'password' => $password])[0] === 200, 'Login accepts valid session CSRF');
    check(request($admin, 'me')[1]['user']['role'] === 'admin', 'Session persists across requests');
    $doctorEmail = $prefix . '-doctor@example.test'; $emails[] = $doctorEmail;
    $newDoctor = ['name' => 'Review Doctor', 'email' => $doctorEmail, 'password' => $password, 'role' => 'admin'];
    check(mutate($admin, 'admin-add-doctor', $newDoctor)[0] === 201, 'Admin creates doctor');
    check(mutate($admin, 'admin-add-doctor', $newDoctor)[0] === 409, 'Duplicate doctor email rejected');
    $doctorId = userId($db, $doctorEmail); $adminId = userId($db, $adminEmail);
    $doctor = client();
    $login = mutate($doctor, 'login', ['email' => $doctorEmail, 'password' => $password]);
    check($login[0] === 200 && $login[1]['user']['role'] === 'doctor', 'Doctor login and fixed doctor role');
    $otherDoctorEmail = $prefix . '-other-doctor@example.test'; $emails[] = $otherDoctorEmail;
    check(mutate($admin, 'admin-add-doctor', ['name' => 'Other Review Doctor', 'email' => $otherDoctorEmail, 'password' => $password])[0] === 201, 'Second doctor created for ownership checks');
    $otherDoctor = client();
    check(mutate($otherDoctor, 'login', ['email' => $otherDoctorEmail, 'password' => $password])[0] === 200, 'Second doctor login');
    $patientEmail = $prefix . '-patient@example.test'; $emails[] = $patientEmail;
    $patient = client();
    check(mutate($patient, 'register', ['name' => 'Review Patient', 'email' => $patientEmail, 'password' => $password, 'role' => 'admin'])[0] === 201, 'Registration succeeds');
    $patientLogin = mutate($patient, 'login', ['email' => $patientEmail, 'password' => $password]);
    check($patientLogin[0] === 200 && $patientLogin[1]['user']['role'] === 'patient', 'Registration cannot escalate role');
    $date = $db->query('SELECT DATE_ADD(CURDATE(), INTERVAL 3 DAY)')->fetchColumn();
    $slotData = ['slot_date' => $date, 'start_time' => '09:00', 'end_time' => '10:00', 'doctor_id' => $adminId];
    check(mutate($admin, 'doctor-add-slot', $slotData)[0] === 403, 'Admin cannot add doctor availability');
    check(mutate($patient, 'doctor-add-slot', $slotData)[0] === 403, 'Patient cannot add availability');
    check(mutate($admin, 'admin-add-slot', $slotData)[0] === 404, 'Old admin slot endpoint removed');
    check(mutate($doctor, 'doctor-add-slot', $slotData)[0] === 201, 'Doctor creates slot using session identity');
    $slots = request($doctor, 'doctor-slots')[1]; $slotId = (int)$slots[0]['id'];
    check(count($slots) === 1, 'Doctor sees own schedule');
    check(request($otherDoctor, 'doctor-slots')[1] === [], 'Doctor cannot view another doctor schedule');
    check(mutate($otherDoctor, 'doctor-delete-slot', ['slot_id' => $slotId])[0] === 409, 'Doctor cannot remove another doctor slot');
    check(mutate($doctor, 'doctor-add-slot', $slotData)[0] === 422, 'Overlapping slot rejected');
    $invalidSlot = $slotData; $invalidSlot['slot_date'] = '2027-02-30';
    check(mutate($doctor, 'doctor-add-slot', $invalidSlot)[0] === 422, 'Invalid calendar date rejected');
    check(count(array_filter(request($patient, 'slots')[1], fn($s) => (int)$s['id'] === $slotId && (int)$s['doctor_id'] === $doctorId)) === 1, 'Patient sees slot assigned to session doctor');
    $service = $db->query('SELECT id FROM services WHERE duration_minutes <= 60 LIMIT 1')->fetchColumn();
    if (!$service) { throw new RuntimeException('Import database/seed.sql before HTTP booking checks'); }
    $booking = ['service_id' => (int)$service, 'slot_id' => $slotId];
    check(mutate($patient, 'book', $booking)[0] === 201, 'Patient books available slot');
    check(mutate($patient, 'book', $booking)[0] === 409, 'API prevents double booking');
    $appointments = request($patient, 'my-appointments')[1]; $appointmentId = (int)$appointments[0]['id'];
    check(mutate($doctor, 'doctor-delete-slot', ['slot_id' => $slotId])[0] === 409, 'Booked slot protected from deletion');
    check(mutate($patient, 'cancel', ['appointment_id' => $appointmentId])[0] === 200, 'Patient cancels own future appointment');
    check(mutate($patient, 'book', $booking)[0] === 201, 'Cancelled slot can be booked again');
    $own = request($doctor, 'doctor-appointments')[1];
    $pending = array_values(array_filter($own, fn($a) => $a['status'] === 'pending'))[0];
    check(mutate($admin, 'admin-update', ['appointment_id' => $pending['id'], 'status' => 'confirmed'])[0] === 422, 'Admin cannot confirm');
    check(mutate($otherDoctor, 'doctor-update', ['appointment_id' => $pending['id'], 'status' => 'confirmed'])[0] === 409, 'Doctor cannot confirm another doctor booking');
    check(mutate($doctor, 'doctor-update', ['appointment_id' => $pending['id'], 'status' => 'confirmed'])[0] === 200, 'Doctor confirms assigned booking');
    check(mutate($doctor, 'doctor-update', ['appointment_id' => $pending['id'], 'status' => 'completed'])[0] === 409, 'Doctor cannot complete before end');
    check(count(array_filter(request($admin, 'admin-appointments')[1], fn($a) => (int)$a['id'] === (int)$pending['id'])) === 1, 'Admin monitors booking');
    check(mutate($admin, 'admin-update', ['appointment_id' => $pending['id'], 'status' => 'cancelled'])[0] === 200, 'Admin cancels future booking');
    check(mutate($doctor, 'doctor-delete-slot', ['slot_id' => $slotId])[0] === 409, 'Cancelled booking history retained');
    $slotData['start_time'] = '10:00'; $slotData['end_time'] = '11:00';
    check(mutate($doctor, 'doctor-add-slot', $slotData)[0] === 201, 'Adjacent slot accepted');
    $free = array_values(array_filter(request($doctor, 'doctor-slots')[1], fn($s) => $s['start_time'] === '10:00:00'))[0];
    check(mutate($doctor, 'doctor-delete-slot', ['slot_id' => $free['id']])[0] === 200, 'Doctor deletes unused future slot');
    $s = $db->prepare("INSERT INTO appointment_slots(doctor_id,slot_date,start_time,end_time) VALUES(?, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '09:00', '10:00')");
    $s->execute([$doctorId]); $pastSlot = (int)$db->lastInsertId();
    $s = $db->prepare("INSERT INTO appointments(patient_id,service_id,slot_id,status) VALUES(?,?,?,'confirmed')");
    $s->execute([userId($db, $patientEmail), (int)$service, $pastSlot]); $pastBooking = (int)$db->lastInsertId();
    check(mutate($patient, 'cancel', ['appointment_id' => $pastBooking])[0] === 409, 'Patient cannot cancel past appointment');
    check(mutate($doctor, 'doctor-update', ['appointment_id' => $pastBooking, 'status' => 'completed'])[0] === 200, 'Doctor completes ended appointment');
    check(mutate($admin, 'admin-update', ['appointment_id' => $pastBooking, 'status' => 'cancelled'])[0] === 409, 'Admin cannot cancel completed appointment');
    $s = $db->prepare("UPDATE users SET role='patient' WHERE id=?"); $s->execute([$adminId]);
    check(request($admin, 'admin-doctors')[0] === 403, 'Database role change revokes stale session permissions');
    check(request($admin, 'me')[1]['user']['role'] === 'patient', 'Me reports current database role');
    check(mutate($doctor, 'logout')[0] === 200, 'Logout accepts session CSRF');
    check(request($doctor, 'me')[0] === 401, 'Logout clears authentication');
    check(request($doctor, 'doctor-appointments')[0] === 403, 'Logout blocks protected data');
    echo "\n$passed checks passed. Browser navigation/layout checks remain manual.\n";
} finally {
    foreach ($emails as $email) {
        $id = userId($db, $email);
        if (!$id) { continue; }
        $s = $db->prepare('DELETE a FROM appointments a JOIN appointment_slots s ON s.id=a.slot_id WHERE s.doctor_id=?'); $s->execute([$id]);
        $s = $db->prepare('DELETE FROM appointments WHERE patient_id=?'); $s->execute([$id]);
        $s = $db->prepare('DELETE FROM appointment_slots WHERE doctor_id=?'); $s->execute([$id]);
    }
    foreach ($emails as $email) { $s = $db->prepare('DELETE FROM users WHERE email=?'); $s->execute([$email]); }
    foreach ($clients as $c) { curl_close($c); }
}
