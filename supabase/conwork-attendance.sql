-- ConWork · ลงเวลาเข้า–ออกงาน / ลากิจ / ลาป่วย (js/attendance.js)
-- เพิ่มอย่างเดียว ไม่แก้ตารางหรือฟังก์ชันเดิม · รันซ้ำได้
-- รันใน Neon SQL Editor (โปรเจกต์ ConWork, database neondb) ที่เดียวกับไฟล์ SQL บัญชี
begin;

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  user_name text,
  kind text not null check (kind in ('work', 'personal_leave', 'sick_leave')),
  start_date date not null,
  end_date date not null,
  time_in time,                 -- เข้า–ออกงาน: เวลาเข้า
  time_out time,                -- เข้า–ออกงาน: เวลาออก
  period text not null default 'full' check (period in ('full', 'morning', 'afternoon')), -- ลา: ทั้งวัน / ครึ่งเช้า / ครึ่งบ่าย
  note text check (note is null or length(note) <= 1000),
  guest_emails text[] not null default '{}',   -- อีเมลที่ถูกเชิญใน Google Calendar
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (kind <> 'work' or (time_in is not null and time_out is not null))
);
create index if not exists attendance_records_company on public.attendance_records (company_id, start_date desc);
create index if not exists attendance_records_user on public.attendance_records (user_id, start_date desc);

alter table public.attendance_records enable row level security;

-- สมาชิกทุกคนในทีมเห็นรายการของทีม
drop policy if exists attendance_read on public.attendance_records;
create policy attendance_read on public.attendance_records for select using (
  exists (select 1 from public.company_members m where m.company_id = attendance_records.company_id and m.user_id = auth.uid())
);
-- บันทึกได้เฉพาะของตัวเอง ในทีมที่ตัวเองเป็นสมาชิก
drop policy if exists attendance_insert on public.attendance_records;
create policy attendance_insert on public.attendance_records for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.company_members m where m.company_id = attendance_records.company_id and m.user_id = auth.uid())
);
-- ลบได้เฉพาะของตัวเอง
drop policy if exists attendance_delete on public.attendance_records;
create policy attendance_delete on public.attendance_records for delete using (user_id = auth.uid());

grant select, insert, delete on public.attendance_records to authenticated;

commit;
