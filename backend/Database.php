<?php
class Database {
    public function connect(): PDO {
        // Local overrides stay outside version control; environment variables also work.
        $localPath = __DIR__ . "/config.local.php";
        $local = is_file($localPath) ? require $localPath : [];
        $host = $local["host"] ?? (getenv("DB_HOST") ?: "localhost");
        $name = $local["name"] ?? (getenv("DB_NAME") ?: "dental_system");
        $username = $local["username"] ?? (getenv("DB_USER") ?: "root");
        $password = $local["password"] ?? (getenv("DB_PASSWORD") ?: "");
        $timezone = $local["timezone"] ?? (getenv("APP_TIMEZONE") ?: "Asia/Amman");
        date_default_timezone_set($timezone);
        $conn = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
        $conn->exec("SET time_zone = " . $conn->quote((new DateTimeImmutable())->format("P")));
        return $conn;
    }
}
