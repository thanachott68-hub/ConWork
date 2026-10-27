<?php
// api/login.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

require_once 'db_connect.php';

// รับข้อมูล JSON จาก Frontend
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->email) && !empty($data->password)) {
    
    // 1. ค้นหาผู้ใช้จากอีเมล
    $query = "SELECT * FROM users WHERE email = :email";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':email', $data->email);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // 2. ตรวจสอบรหัสผ่านที่ส่งมา เทียบกับรหัสผ่านที่แฮชไว้ในฐานข้อมูล
        if (password_verify($data->password, $row['password'])) {
            // รหัสผ่านถูกต้อง
            
            // ลบรหัสผ่านออกจาก array ก่อนส่งกลับไปยัง Frontend
            unset($row['password']);
            
            echo json_encode([
                "status" => "success", 
                "message" => "เข้าสู่ระบบสำเร็จ",
                "user" => $row
            ]);
        } else {
            // รหัสผ่านผิด
            echo json_encode(["status" => "error", "message" => "อีเมลหรือรหัสผ่านไม่ถูกต้อง"]);
        }
    } else {
        // ไม่พบอีเมลในระบบ
        echo json_encode(["status" => "error", "message" => "อีเมลหรือรหัสผ่านไม่ถูกต้อง"]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "กรุณากรอกอีเมลและรหัสผ่าน"]);
}
?>
