<?php 
class Database {
    private string $host = "localhost";
    private string $dbName = "dental_system";
    private string $username = "root";
    private string $password = "";

    public function connect(): PDO {
        $dsn = "mysql:host={$this->host};dbname={$this->dbName};charset=utf8mb4";
        $conn = new PDO($dsn, $this->username, $this->password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
        return $conn;
        }
}
?>