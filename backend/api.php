<?php
session_start();

require_once __DIR__ . "/Database.php";
require_once __DIR__ . "/User.php";
require_once __DIR__ . "/Appointment.php";
require_once __DIR__ . "/Admin.php";

header("Content-Type: application/json; charset=UTF-8");

$database = new Database() ;
$conn = $database->connect();

$userModel = new User($conn) ;
$appointmentModel = new Appointment($conn);
$adminModel = new Admin($conn);

$action = $_GET["action"] ?? "";

$input = json_decode(file_get_contents("php://input"), true) ?? [];


try {
    // Refresh authorization before any action uses the session role.
    if (isset($_SESSION["user_id"])) {
        $stmt = $conn->prepare("SELECT role FROM users WHERE id = :id");
        $stmt->execute(["id" => $_SESSION["user_id"]]);
        $currentRole = $stmt->fetchColumn();

        if ($currentRole === false) {
            unset($_SESSION["user_id"], $_SESSION["role"]);
        } else {
            $_SESSION["role"] = $currentRole;
        }
    }

    if ($action === "register") {
        if ($_SERVER["REQUEST_METHOD"] !== "POST") {
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
            exit;
        }

        $name = trim($input["name"] ?? "");
        $email = trim($input["email"] ?? "");
        $password = $input["password"] ?? "";

        if ($name === "" || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
            http_response_code(422);
            echo json_encode(["error" => "Invalid registeration data"]);
            exit;
        }

        $userModel->register($name, $email, $password);

        http_response_code(201);
        echo json_encode(["message" => "Registerd successfully"]);

    } elseif($action === "login") {
        if ($_SERVER["REQUEST_METHOD"] !== "POST") {
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
            exit;
        }

        $email = trim($input["email"] ?? "");
        $password = $input["password"] ?? "";

        $user = $userModel->login($email, $password);

        if (!$user) {
            http_response_code(401);
            echo json_encode(["error" => "Invalid credentials"]);
            exit;
        }

        session_regenerate_id(true);
        $_SESSION["user_id"] = $user["id"];
        $_SESSION["role"] = $user["role"];

        echo json_encode([
            "message" => "Login successful",
            "user" => $user
        ]);
    }
elseif ($action === "services" && $_SERVER["REQUEST_METHOD"] === "GET") {
    echo json_encode($appointmentModel->getServices());

} elseif ($action === "slots" && $_SERVER["REQUEST_METHOD"] === "GET") {
    echo json_encode($appointmentModel->getAvailableSlots());

} elseif ($action === "book" && $_SERVER["REQUEST_METHOD"] === "POST") {
    if (!isset($_SESSION["user_id"]) || ($_SESSION["role"] ?? "") !== "patient") {
        http_response_code(403);
        echo json_encode(["error" => "Patient access required"]);
        exit;
    }

    $serviceId = filter_var($input["service_id"] ?? null, FILTER_VALIDATE_INT);
    $slotId = filter_var($input["slot_id"] ?? null, FILTER_VALIDATE_INT);

    if (!$serviceId || !$slotId) {
        http_response_code(422);
        echo json_encode(["error" => "Invalid service or slot"]);
        exit;
    }

    $appointmentModel->book((int)$_SESSION["user_id"], $serviceId, $slotId);

    http_response_code(201);
    echo json_encode(["message" => "Appointment booked successfully"]);

} elseif ($action === "my-appointments" && $_SERVER["REQUEST_METHOD"] === "GET") {
    if (!isset($_SESSION["user_id"]) || ($_SESSION["role"] ?? "") !== "patient") {
        http_response_code(403);
        echo json_encode(["error" => "Patient access required"]);
        exit;
    }

    echo json_encode(
        $appointmentModel->getByPatient((int)$_SESSION["user_id"])
    );

} elseif ($action === "cancel" && $_SERVER["REQUEST_METHOD"] === "POST") {
    if (!isset($_SESSION["user_id"]) || ($_SESSION["role"] ?? "") !== "patient") {
        http_response_code(403);
        echo json_encode(["error" => "Patient access required"]);
        exit;
    }

    $appointmentId = filter_var($input["appointment_id"] ?? null, FILTER_VALIDATE_INT);

    if (!$appointmentId) {
        http_response_code(422);
        echo json_encode(["error" => "Invalid appointment ID"]);
        exit;
    }

    $cancelled = $appointmentModel->cancel(
        $appointmentId,
        (int)$_SESSION["user_id"]
    );

    if (!$cancelled) {
        http_response_code(409);
        echo json_encode(["error" => "Appointment cannot be cancelled"]);
        exit;
    }

    echo json_encode(["message" => "Appointment cancelled successfully"]);
}elseif ($action === "me" && $_SERVER["REQUEST_METHOD"] === "GET") {
    if (!isset($_SESSION["user_id"])) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthenticated"]);
        exit;
    }

    $stmt = $conn->prepare(
        "SELECT id, name, email, role FROM users WHERE id = :id"
    );

    $stmt->execute(["id" => $_SESSION["user_id"]]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthenticated"]);
        exit;
    }

    echo json_encode(["user" => $user]);
}

elseif ($action === "doctor-appointments" && $_SERVER["REQUEST_METHOD"] === "GET") {
    if (!isset($_SESSION["user_id"]) || ($_SESSION["role"] ?? "") !== "doctor") {
        http_response_code(403);
        echo json_encode(["error" => "Doctor access required"]);
        exit;
    }

    echo json_encode(
        $appointmentModel->getByDoctor((int)$_SESSION["user_id"])
    );

} elseif ($action === "doctor-update" && $_SERVER["REQUEST_METHOD"] === "POST") {
    if (!isset($_SESSION["user_id"]) || ($_SESSION["role"] ?? "") !== "doctor") {
        http_response_code(403);
        echo json_encode(["error" => "Doctor access required"]);
        exit;
    }

    $appointmentId = filter_var(
        $input["appointment_id"] ?? null,
        FILTER_VALIDATE_INT
    );

    $status = $input["status"] ?? "";

    if (!$appointmentId || $appointmentId < 1 || !in_array($status, ["confirmed", "completed"], true)) {
        http_response_code(422);
        echo json_encode(["error" => "Invalid appointment data"]);
        exit;
    }

    $updated = $appointmentModel->updateDoctorStatus(
        (int)$appointmentId,
        (int)$_SESSION["user_id"],
        $status
    );

    if (!$updated) {
        http_response_code(409);
        echo json_encode(["error" => "Cannot update this appointment"]);
        exit;
    }

    echo json_encode(["message" => "Appointment updated successfully"]);
}
elseif (in_array($action, ["doctor-add-slot", "doctor-slots", "doctor-delete-slot"], true)) {
    if (!isset($_SESSION["user_id"]) || ($_SESSION["role"] ?? "") !== "doctor") {
        http_response_code(403);
        echo json_encode(["error" => "Doctor access required"]);
        exit;
    }
    $doctorId = (int)$_SESSION["user_id"];
    if ($action === "doctor-slots" && $_SERVER["REQUEST_METHOD"] === "GET") {
        echo json_encode($appointmentModel->getDoctorSlots($doctorId));
    } elseif ($action === "doctor-add-slot" && $_SERVER["REQUEST_METHOD"] === "POST") {
        $date = $input["slot_date"] ?? "";
        $start = $input["start_time"] ?? "";
        $end = $input["end_time"] ?? "";
        if (!is_string($date) || !is_string($start) || !is_string($end)
            || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
            || !preg_match('/^\d{2}:\d{2}$/', $start)
            || !preg_match('/^\d{2}:\d{2}$/', $end)) {
            http_response_code(422);
            echo json_encode(["error" => "Invalid slot data"]);
            exit;
        }
        $appointmentModel->addSlot($doctorId, $date, $start, $end);
        http_response_code(201);
        echo json_encode(["message" => "Slot created successfully"]);
    } elseif ($action === "doctor-delete-slot" && $_SERVER["REQUEST_METHOD"] === "POST") {
        $slotId = filter_var($input["slot_id"] ?? null, FILTER_VALIDATE_INT);
        if (!$slotId || $slotId < 1) {
            http_response_code(422);
            echo json_encode(["error" => "Invalid slot ID"]);
            exit;
        }
        if (!$appointmentModel->deleteDoctorSlot($slotId, $doctorId)) {
            http_response_code(409);
            echo json_encode(["error" => "Only your future slots without booking history can be deleted"]);
            exit;
        }
        echo json_encode(["message" => "Slot removed successfully"]);
    } else {
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
    }
}
elseif (
    in_array($action, [
        "admin-doctors",
        "admin-appointments",
        "admin-update"
    ], true)
) {
    if (
        !isset($_SESSION["user_id"]) ||
        ($_SESSION["role"] ?? "") !== "admin"
    ) {
        http_response_code(403);
        echo json_encode(["error" => "Admin access required"]);
        exit;
    }

    if ($action === "admin-doctors" && $_SERVER["REQUEST_METHOD"] === "GET") {
        echo json_encode($adminModel->getDoctors());

    } elseif ($action === "admin-appointments" && $_SERVER["REQUEST_METHOD"] === "GET") {
        echo json_encode($adminModel->getAppointments());

    } elseif ($action === "admin-update" && $_SERVER["REQUEST_METHOD"] === "POST") {
        $appointmentId = filter_var(
            $input["appointment_id"] ?? null,
            FILTER_VALIDATE_INT
        );

        $status = $input["status"] ?? "";

        if (!$appointmentId || $appointmentId < 1 || !in_array($status, ["cancelled"], true)) {
            http_response_code(422);
            echo json_encode(["error" => "Invalid appointment data"]);
            exit;
        }

        $updated = $adminModel->updateAppointment(
            $appointmentId,
            $status
        );

        if (!$updated) {
            http_response_code(409);
            echo json_encode(["error" => "Appointment cannot be updated"]);
            exit;
        }

        echo json_encode(["message" => "Appointment updated successfully"]);

    } else {
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
    }
}
     else {
        http_response_code(404);
        echo json_encode(["error" => "Action not found"]);
    }
} catch (InvalidArgumentException $e) {
    http_response_code(422);
    echo json_encode(["error" => $e->getMessage()]);

} catch (PDOException $e) {
    $mysqlError = $e->errorInfo[1] ?? null;

    if ($mysqlError === 1062) {
        http_response_code(409);
        echo json_encode([
            "error" => $action === "register"
                ? "Email already exists"
                : "Slot already booked"
        ]);
    } else {
    http_response_code(500);

    echo json_encode([
        "error" => "Server error",
        "details" => $e->getMessage(),
        "sql_code" => $e->getCode()
    ]);
}
}

?>