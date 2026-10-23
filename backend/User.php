<?PHP 
class User {
    private PDO $conn;

    public function __construct(PDO $conn) {
        $this->conn = $conn;
    }

    public function register(string $name, string $email, string $password ) :bool {
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $sql = "INSERT INTO users (name, email, password, role)
                VALUES (:name, :email, :password, 'patient')";
        
        $stmt = $this->conn->prepare($sql);

        return $stmt->execute([
            "name" => $name,
            "email" => $email,
            "password" => $hashedPassword
        ]);
    }

    public function login(string $email, string $password): array|false {
        $sql = "SELECT * FROM users WHERE email = :email";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute(["email" => $email]);

        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user["password"])) {
            return false;
        }

        unset($user["password"]);

        return $user;
    }
}
?>