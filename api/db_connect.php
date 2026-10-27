<?php
// api/db_connect.php
$servername = "localhost";
$username = "root";
$password = ""; // ใส่รหัสผ่านของ XAMPP MySQL (ค่าเริ่มต้นคือว่างเปล่า "")
$dbname = "conwork_project";

try {
    $conn = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8", $username, $password);
    // ตั้งค่า PDO ให้แจ้งเตือนเมื่อเกิด Error
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die(json_encode(["status" => "error", "message" => "Connection failed: " . $e->getMessage()]));
}
?>
