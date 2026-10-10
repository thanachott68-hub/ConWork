-- database_schema.sql
-- นำโค้ดนี้ไปรันใน phpMyAdmin หรือโปรแกรมจัดการฐานข้อมูล MySQL ของคุณ

CREATE DATABASE IF NOT EXISTS conwork_project CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE conwork_project;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'worker',
    department VARCHAR(100) DEFAULT 'พนักงานทั่วไป',
    avatar VARCHAR(255) DEFAULT 'https://i.pravatar.cc/150',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ข้อมูลจำลองผู้ดูแลระบบ (รหัสผ่านคือ: Admin123!)
-- รหัสผ่านถูกเข้ารหัสด้วย Bcrypt เรียบร้อยแล้ว
INSERT INTO users (name, username, email, password, role, department) 
VALUES ('System Admin', 'admin', 'admin@conwork.com', '$2y$10$RzVfHl/99O2a2fTjP/c..O4c2iYcR4s7Zq9iB8qVfJb3Uf8V8X.x2', 'admin', 'ผู้บริหาร') 
ON DUPLICATE KEY UPDATE name=name;
