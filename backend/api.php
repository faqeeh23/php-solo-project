<?php
ini_set("session.use_strict_mode", "1");
session_set_cookie_params([
    "httponly" => true,
    "secure" => !empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off",
    "samesite" => "Lax"
]);
session_start();
header("Cache-Control: no-store");
if (!isset($_SESSION["csrf_token"])) {
    $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
}

require_once __DIR__ . "/Database.php";
require_once __DIR__ . "/User.php";
require_once __DIR__ . "/Appointment.php";
require_once __DIR__ . "/Admin.php";

header("Content-Type: application/json; charset=UTF-8");

$action = $_GET["action"] ?? "";

if ($action === "csrf-token" && $_SERVER["REQUEST_METHOD"] === "GET") {
    echo json_encode(["csrf_token" => $_SESSION["csrf_token"]]);
    exit;
}

if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "HEAD", "OPTIONS"], true)) {
    $token = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    if (!is_string($token) || !hash_equals($_SESSION["csrf_token"], $token)) {
        http_response_code(403);
        echo json_encode(["error" => "Invalid CSRF token"]);
        exit;
    }
}

$rawInput = file_get_contents("php://input");
$input = $rawInput === "" ? [] : json_decode($rawInput, true);
if (!is_array($input)) {
    http_response_code(422);
    echo json_encode(["error" => "Invalid JSON request"]);
    exit;
}


try {
    $database = new Database() ;
    $conn = $database->connect();

    $userModel = new User($conn) ;
    $appointmentModel = new Appointment($conn);
    $adminModel = new Admin($conn);

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

    if ($action === "logout" && $_SERVER["REQUEST_METHOD"] === "POST") {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), "", [
                "expires" => time() - 42000,
                "path" => $params["path"],
                "domain" => $params["domain"],
                "secure" => $params["secure"],
                "httponly" => $params["httponly"],
                "samesite" => $params["samesite"] ?: "Lax"
            ]);
        }
        session_destroy();
        echo json_encode(["message" => "Logged out successfully"]);
    } elseif ($action === "register") {
        if ($_SERVER["REQUEST_METHOD"] !== "POST") {
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
            exit;
        }

        $name = $input["name"] ?? "";
        $email = $input["email"] ?? "";
        $password = $input["password"] ?? "";
        if (!is_string($name) || !is_string($email) || !is_string($password)) {
            throw new InvalidArgumentException("Invalid registration data");
        }
        $name = trim($name);
        $email = trim($email);

        if ($name === "" || mb_strlen($name) > 100 || strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 72) {
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

        $email = $input["email"] ?? "";
        $password = $input["password"] ?? "";
        if (!is_string($email) || !is_string($password)) {
            throw new InvalidArgumentException("Invalid login data");
        }
        $email = trim($email);

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
        "admin-add-doctor",
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

    if ($action === "admin-add-doctor" && $_SERVER["REQUEST_METHOD"] === "POST") {
        $name = $input["name"] ?? null;
        $email = $input["email"] ?? null;
        $password = $input["password"] ?? null;
        if (!is_string($name) || !is_string($email) || !is_string($password)) {
            http_response_code(422);
            echo json_encode(["error" => "Invalid doctor data"]);
            exit;
        }
        $adminModel->addDoctor($name, $email, $password);
        http_response_code(201);
        echo json_encode(["message" => "Doctor account created successfully"]);
    } elseif ($action === "admin-doctors" && $_SERVER["REQUEST_METHOD"] === "GET") {
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
            "error" => in_array($action, ["register", "admin-add-doctor"], true)
                ? "Email already exists"
                : "Slot already booked"
        ]);
    } else {
    http_response_code(500);

    error_log($e->getMessage());
    echo json_encode(["error" => "Server error"]);
}
}

?>
