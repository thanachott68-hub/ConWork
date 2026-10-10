<?php
// api/register.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

require_once 'db_connect.php';

// รับข้อมูล JSON จาก Frontend
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->name) && !empty($data->email) && !empty($data->password)) {
    
    // 1. ตรวจสอบว่ามีอีเมลนี้ในระบบแล้วหรือยัง
    $check_stmt = $conn->prepare("SELECT id FROM users WHERE email = :email");
    $check_stmt->bindParam(':email', $data->email);
    $check_stmt->execute();
    
    if ($check_stmt->rowCount() > 0) {
        echo json_encode(["status" => "error", "message" => "อีเมลนี้ถูกใช้งานแล้ว"]);
        exit();
    }

    // 2. แฮชรหัสผ่านเพื่อความปลอดภัยขั้นสูงสุด (ห้ามเก็บ Plain Text)
    $hashed_password = password_hash($data->password, PASSWORD_BCRYPT);
    
    $role = !empty($data->role) ? $data->role : 'worker';
    $department = 'พนักงานทั่วไป';
    if ($role === 'admin' || $role === 'reviewer2') $department = 'ผู้บริหาร';
    else if ($role === 'reviewer1') $department = 'พัฒนาระบบ';
    
    $username = explode('@', $data->email)[0];
    
    // 3. บันทึกข้อมูลผู้ใช้ใหม่ลงฐานข้อมูล
    $query = "INSERT INTO users (name, username, email, password, role, department) 
              VALUES (:name, :username, :email, :password, :role, :department)";
              
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':name', $data->name);
    $stmt->bindParam(':username', $username);
    $stmt->bindParam(':email', $data->email);
    $stmt->bindParam(':password', $hashed_password);
    $stmt->bindParam(':role', $role);
    $stmt->bindParam(':department', $department);
    
    if ($stmt->execute()) {
        $user_id = $conn->lastInsertId();
        
        echo json_encode([
            "status" => "success", 
            "message" => "สมัครสมาชิกสำเร็จ",
            "user" => [
                "id" => $user_id,
                "name" => $data->name,
                "username" => $username,
                "email" => $data->email,
                "role" => $role,
                "department" => $department
            ]
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "ไม่สามารถสมัครสมาชิกได้ เกิดข้อผิดพลาด"]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "กรุณากรอกข้อมูลให้ครบถ้วน"]);
}
?>
