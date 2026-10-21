<?php
require_once __DIR__ . "/Database.php";
require_once __DIR__ . "/User.php";



header("Content-Type: application/json; charset=UTF-8");

$database = new Database() ;
$conn = $database->connect();

$userModel = new User($conn) ;

$action = $_GET["action"] ?? "";

$input = json_decode(file_get_contents("php://input"), true) ?? [];


try {
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

        if (!user) {
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
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Action not found"]);
    }
}catch (PDOException $e) {
    if ($e->getCode() === "23000" && $action === "register") {
        http_response_code(409);
        echo json_encode(["error" => "Email already exists"]);
    } else {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode(["error" => "Server error"]);
    }

}
?>