# 🚀 คู่มือการตั้งค่าและติดตั้ง Supabase สำหรับ ConWork (Supabase Setup Guide)

คู่มือนี้สรุปขั้นตอนการนำไฟล์ **`supabase/schema.sql`** ไปติดตั้งบน **Supabase** และเชื่อมต่อเข้ากับเว็บแอปพลิเคชัน ConWork

---

## 📌 ขั้นตอนที่ 1: สร้างโปรเจกต์บน Supabase (Supabase Project Setup)

1. สมัครหรือเข้าสู่ระบบที่ [Supabase.com](https://supabase.com)
2. กดปุ่ม **"New Project"**
3. กรอกรายละเอียด:
   - **Name:** `ConWork-Production` (หรือชื่อตามต้องการ)
   - **Database Password:** ตั้งรหัสผ่านฐานข้อมูล (และจดบันทึกไว้)
   - **Region:** เลือกภูมิภาคใกล้เคียง (เช่น `Singapore - ap-southeast-1`)
4. กด **"Create new project"** และรอประมาณ 1-2 นาทีให้ฐานข้อมูลสร้างเสร็จ

---

## 📌 ขั้นตอนที่ 2: รันไฟล์ SQL Schema บน Supabase (Database Initialization)

1. ในหน้าเมนูของ Supabase ให้คลิกแถบ **SQL Editor** (ไอคอน `>/_` ฝั่งซ้าย)
2. กดปุ่ม **"+ New query"**
3. คัดลอกเนื้อหาทั้งหมดจากไฟล์ [supabase/schema.sql](file:///c:/Users/ASUS%20VIVOBOOK/OneDrive/Documents/Project-077%20%28Final%29/Project-076%20%28Final%29/Project-075/Project-066-%E0%B8%97%E0%B8%B3/supabase/schema.sql) มาวางในช่องแก้ไข
4. กดปุ่ม **"Run"** (หรือกด Ctrl+Enter)
5. ตรวจสอบข้อความแจ้งเตือนว่าขึ้น **`Success. No rows returned`**

---

## 📌 ขั้นตอนที่ 3: ดึง API Key และเชื่อมต่อกับโปรเจกต์

1. ไปที่เมนู **Project Settings** (ไอคอนฟันเฟือง ⚙️) -> เลือก **API**
2. คัดลอกค่า 2 ค่าต่อไปนี้:
   - **Project URL** (เช่น `https://xyzcompany.supabase.co`)
   - **Project API keys** -> ค่า **`anon` `public`**
3. เปิดไฟล์ [js/config.js](file:///c:/Users/ASUS%20VIVOBOOK/OneDrive/Documents/Project-077%20%28Final%29/Project-076%20%28Final%29/Project-075/Project-066-%E0%B8%97%E0%B8%B3/js/config.js) ในโปรเจกต์ และทำการอัปเดตค่าดังนี้:

```javascript
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api',
    ENV: 'development',
    TIMEOUT: 10000,
    STORAGE_PREFIX: 'conwork_',

    // ตั้งค่า Supabase Backend Integration
    USE_SUPABASE: true, // เปิดใช้งาน Supabase
    SUPABASE_URL: 'https://xyzcompany.supabase.co', // ใส่ Project URL ของคุณ
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' // ใส่ anon public key ของคุณ
};
```

---

## 🛡️ สรุปสิ่งที่ระบบ Supabase ของ ConWork ทำให้อัตโนมัติ:

1. **Auto User Profile:** เมื่อผู้ใช้สมัครสมาชิกผ่าน `auth.signUp()` โค้ด Trigger ใน Postgres จะนำข้อมูลผู้ใช้ไปสร้างลงตาราง `profiles` อัตโนมัติ
2. **Multi-tenant Data Isolation:** Row Level Security (RLS) Policies ป้องกันไม่ให้ผู้ใช้ต่างบริษัทมองเห็นข้อมูลโปรเจกต์ งาน แชท หรือปฏิทินของกันและกัน
3. **Real-time Chat:** รองรับการซิงค์ข้อความแชทใหม่ทันทีผ่าน Supabase Realtime Subscription
