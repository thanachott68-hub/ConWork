-- ConWork · ผังบัญชีเริ่มต้นชุดใหม่ (ตามเอกสาร "สรุปบัญชีพื้นฐาน")
-- เลข 5 หลัก: หลักที่ 1 = หมวด (1 สินทรัพย์ 2 หนี้สิน 3 ส่วนของเจ้าของ 4 รายได้ 5 ค่าใช้จ่าย)
--            หลักที่ 2 = กลุ่ม (สินทรัพย์/หนี้สิน: 1 หมุนเวียน 2 ไม่หมุนเวียน) · 3 หลักท้ายเรียงตามสภาพคล่อง ขึ้นทีละ 10
-- ไม่มี ตั๋วเงินรับ ตั๋วเงินจ่าย และหุ้นกู้ · บัญชีที่ระบบลงอัตโนมัติ (เงินสด ธนาคาร ลูกหนี้ เจ้าหนี้ VAT ภาษีหัก ณ ที่จ่าย กำไรสะสม) ยังอยู่ครบ
-- รันครั้งเดียวใน Neon SQL Editor (โปรเจกต์ ConWork, database neondb) · รันซ้ำได้
begin;

-- 1) ผังบัญชีเริ่มต้นของบริษัทใหม่ (70 บัญชี)
create or replace function public._cw_seed_coa(p_company uuid)
 returns void language sql security definer set search_path to 'public'
as $function$
  insert into public.accounts (company_id, code, name_th, name_en, type, normal_side, role, is_system)
  select p_company, v.code, v.th, v.en, v.t, v.side, v.role, true from (values
    ('11010', 'เงินสด', 'Cash', 'asset', 'debit', 'cash'),
    ('11020', 'เงินฝากธนาคาร', 'Bank deposits', 'asset', 'debit', 'bank'),
    ('11030', 'เงินลงทุนระยะสั้น', 'Short-term investments', 'asset', 'debit', null),
    ('11040', 'ลูกหนี้การค้า', 'Accounts receivable', 'asset', 'debit', 'ar'),
    ('11050', 'ค่าเผื่อหนี้สงสัยจะสูญ', 'Allowance for doubtful accounts', 'asset', 'credit', null),
    ('11060', 'เงินให้กู้ยืมระยะสั้น', 'Short-term loans', 'asset', 'debit', null),
    ('11070', 'สินค้าคงเหลือ', 'Inventory', 'asset', 'debit', null),
    ('11080', 'วัสดุสิ้นเปลือง', 'Supplies', 'asset', 'debit', null),
    ('11090', 'วัสดุสำนักงาน', 'Office supplies', 'asset', 'debit', null),
    ('11100', 'รายได้ค้างรับ', 'Accrued revenue', 'asset', 'debit', null),
    ('11110', 'ค่าใช้จ่ายจ่ายล่วงหน้า', 'Prepaid expenses', 'asset', 'debit', null),
    ('11120', 'เงินทดรองจ่าย', 'Advances', 'asset', 'debit', null),
    ('11130', 'ภาษีซื้อ (VAT 7%)', 'Input VAT (7%)', 'asset', 'debit', 'vat_input'),
    ('11140', 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย', 'Withholding tax receivable', 'asset', 'debit', 'wht_receivable'),
    ('12010', 'เงินลงทุนระยะยาว', 'Long-term investments', 'asset', 'debit', null),
    ('12020', 'เงินให้กู้ยืมระยะยาว', 'Long-term loans', 'asset', 'debit', null),
    ('12030', 'ที่ดิน', 'Land', 'asset', 'debit', null),
    ('12040', 'อาคาร', 'Buildings', 'asset', 'debit', null),
    ('12050', 'ค่าเสื่อมราคาสะสม - อาคาร', 'Accumulated depreciation - buildings', 'asset', 'credit', null),
    ('12060', 'อุปกรณ์สำนักงาน', 'Office equipment', 'asset', 'debit', null),
    ('12070', 'อุปกรณ์ร้านค้า', 'Store equipment', 'asset', 'debit', null),
    ('12080', 'เครื่องจักร', 'Machinery', 'asset', 'debit', null),
    ('12090', 'เครื่องตกแต่งและติดตั้ง', 'Furniture and fixtures', 'asset', 'debit', null),
    ('12100', 'ค่าเสื่อมราคาสะสม - อุปกรณ์', 'Accumulated depreciation - equipment', 'asset', 'credit', null),
    ('12110', 'ลิขสิทธิ์', 'Copyrights', 'asset', 'debit', null),
    ('12120', 'สิทธิบัตร', 'Patents', 'asset', 'debit', null),
    ('12130', 'สัมปทาน', 'Franchises', 'asset', 'debit', null),
    ('12140', 'เครื่องหมายการค้า', 'Trademarks', 'asset', 'debit', null),
    ('21010', 'เงินเบิกเกินบัญชีธนาคาร', 'Bank overdrafts', 'liability', 'credit', null),
    ('21020', 'เงินกู้ยืมจากธนาคาร', 'Loans from banks', 'liability', 'credit', null),
    ('21030', 'เจ้าหนี้การค้า', 'Accounts payable', 'liability', 'credit', 'ap'),
    ('21040', 'รายได้รับล่วงหน้า', 'Unearned revenue', 'liability', 'credit', null),
    ('21050', 'ค่าใช้จ่ายค้างจ่าย', 'Accrued expenses', 'liability', 'credit', null),
    ('21060', 'เงินปันผลค้างจ่าย', 'Dividends payable', 'liability', 'credit', null),
    ('21070', 'เงินกู้ยืมระยะยาวที่ถึงกำหนดชำระภายใน 1 ปี', 'Current portion of long-term debt', 'liability', 'credit', null),
    ('21080', 'เงินกู้ยืมระยะสั้น', 'Short-term borrowings', 'liability', 'credit', null),
    ('21090', 'ภาษีขาย (VAT 7%)', 'Output VAT (7%)', 'liability', 'credit', 'vat_output'),
    ('21100', 'ภาษีมูลค่าเพิ่มค้างชำระ', 'VAT payable', 'liability', 'credit', null),
    ('21110', 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', 'Withholding tax payable', 'liability', 'credit', 'wht_payable'),
    ('22010', 'เงินกู้ยืมระยะยาว', 'Long-term debt', 'liability', 'credit', null),
    ('31010', 'ทุนที่ออกและชำระแล้ว', 'Issued and paid-up share capital', 'equity', 'credit', null),
    ('31020', 'ส่วนเกินมูลค่าหุ้น', 'Share premium', 'equity', 'credit', null),
    ('32010', 'สำรองตามกฎหมาย', 'Legal reserve', 'equity', 'credit', null),
    ('32020', 'สำรองอื่น', 'Other reserves', 'equity', 'credit', null),
    ('32030', 'กำไร (ขาดทุน) สะสม - ยังไม่ได้จัดสรร', 'Retained earnings - unappropriated', 'equity', 'credit', 'retained_earnings'),
    ('33010', 'องค์ประกอบอื่นของส่วนของผู้ถือหุ้น', 'Other components of equity', 'equity', 'credit', null),
    ('41010', 'รายได้จากการขายสินค้า', 'Sales revenue', 'income', 'credit', null),
    ('41020', 'รายได้ค่าบริการ', 'Service revenue', 'income', 'credit', null),
    ('42010', 'รายได้อื่น', 'Other income', 'income', 'credit', null),
    ('42020', 'ดอกเบี้ยรับ', 'Interest income', 'income', 'credit', null),
    ('42030', 'กำไรจากการขายสินทรัพย์', 'Gain on sale of assets', 'income', 'credit', null),
    ('51010', 'ต้นทุนขาย', 'Cost of goods sold', 'expense', 'debit', null),
    ('51020', 'ต้นทุนบริการ', 'Cost of services', 'expense', 'debit', null),
    ('52010', 'ค่าโฆษณาและการตลาด', 'Advertising and marketing', 'expense', 'debit', null),
    ('52020', 'ค่านายหน้า', 'Commissions', 'expense', 'debit', null),
    ('52030', 'ค่าขนส่งเมื่อขาย', 'Delivery expenses', 'expense', 'debit', null),
    ('53010', 'เงินเดือนและค่าจ้าง', 'Salaries and wages', 'expense', 'debit', null),
    ('53020', 'ค่าเช่า', 'Rent', 'expense', 'debit', null),
    ('53030', 'ค่าสาธารณูปโภค', 'Utilities', 'expense', 'debit', null),
    ('53040', 'วัสดุสิ้นเปลืองใช้ไป', 'Supplies used', 'expense', 'debit', null),
    ('53050', 'ค่าเดินทาง', 'Travel', 'expense', 'debit', null),
    ('53060', 'ค่าธรรมเนียมวิชาชีพ', 'Professional fees', 'expense', 'debit', null),
    ('53070', 'ค่าเสื่อมราคา', 'Depreciation', 'expense', 'debit', null),
    ('53080', 'ค่าธรรมเนียมธนาคาร', 'Bank charges', 'expense', 'debit', null),
    ('53090', 'หนี้สงสัยจะสูญ', 'Bad debt expense', 'expense', 'debit', null),
    ('53100', 'ค่าเบี้ยประกันภัย', 'Insurance', 'expense', 'debit', null),
    ('54010', 'ค่าใช้จ่ายเบ็ดเตล็ด', 'Miscellaneous expenses', 'expense', 'debit', null),
    ('54020', 'ขาดทุนจากการขายสินทรัพย์', 'Loss on sale of assets', 'expense', 'debit', null),
    ('55010', 'ดอกเบี้ยจ่าย', 'Interest expense', 'expense', 'debit', null),
    ('56010', 'ภาษีเงินได้นิติบุคคล', 'Corporate income tax', 'expense', 'debit', null)
  ) as v(code, th, en, t, side, role)
  on conflict (company_id, code) do nothing;
$function$;

-- 2) บริษัทที่มีผังบัญชีอยู่แล้ว: ย้ายเลขบัญชีมาตรฐานชุดเดิมไปเลขใหม่ (รายการที่บันทึกแล้วผูกกับบัญชี ไม่ได้ผูกกับเลข จึงอยู่ครบ)
create temp table _coa_map (old_code text, new_code text, th text, en text) on commit drop;
insert into _coa_map values
    ('11010', '11010', 'เงินสด', 'Cash'),
    ('11020', '11020', 'เงินฝากธนาคาร', 'Bank deposits'),
    ('11030', '11040', 'ลูกหนี้การค้า', 'Accounts receivable'),
    ('11050', '11120', 'เงินทดรองจ่าย', 'Advances'),
    ('11040', '11130', 'ภาษีซื้อ (VAT 7%)', 'Input VAT (7%)'),
    ('11060', '11140', 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย', 'Withholding tax receivable'),
    ('12010', '12060', 'อุปกรณ์สำนักงาน', 'Office equipment'),
    ('12020', '12100', 'ค่าเสื่อมราคาสะสม - อุปกรณ์', 'Accumulated depreciation - equipment'),
    ('21010', '21030', 'เจ้าหนี้การค้า', 'Accounts payable'),
    ('21040', '21050', 'ค่าใช้จ่ายค้างจ่าย', 'Accrued expenses'),
    ('21020', '21090', 'ภาษีขาย (VAT 7%)', 'Output VAT (7%)'),
    ('21050', '21100', 'ภาษีมูลค่าเพิ่มค้างชำระ', 'VAT payable'),
    ('21030', '21110', 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', 'Withholding tax payable'),
    ('31010', '31010', 'ทุนที่ออกและชำระแล้ว', 'Issued and paid-up share capital'),
    ('31020', '32030', 'กำไร (ขาดทุน) สะสม - ยังไม่ได้จัดสรร', 'Retained earnings - unappropriated'),
    ('41010', '41010', 'รายได้จากการขายสินค้า', 'Sales revenue'),
    ('41020', '42010', 'รายได้อื่น', 'Other income'),
    ('41030', '42020', 'ดอกเบี้ยรับ', 'Interest income'),
    ('51010', '51010', 'ต้นทุนขาย', 'Cost of goods sold'),
    ('52060', '52010', 'ค่าโฆษณาและการตลาด', 'Advertising and marketing'),
    ('52010', '53010', 'เงินเดือนและค่าจ้าง', 'Salaries and wages'),
    ('52020', '53020', 'ค่าเช่า', 'Rent'),
    ('52030', '53030', 'ค่าสาธารณูปโภค', 'Utilities'),
    ('52040', '53040', 'วัสดุสิ้นเปลืองใช้ไป', 'Supplies used'),
    ('52050', '53050', 'ค่าเดินทาง', 'Travel'),
    ('52070', '53060', 'ค่าธรรมเนียมวิชาชีพ', 'Professional fees'),
    ('52080', '53070', 'ค่าเสื่อมราคา', 'Depreciation'),
    ('52090', '53080', 'ค่าธรรมเนียมธนาคาร', 'Bank charges'),
    ('59010', '54010', 'ค่าใช้จ่ายเบ็ดเตล็ด', 'Miscellaneous expenses');

-- 2.1 พักเลขเดิมไว้ก่อน กันเลขชนกันระหว่างย้าย (เฉพาะบัญชีมาตรฐานที่ยังใช้เลขเดิม)
update public.accounts a set code = '~' || a.code
  from _coa_map m where a.is_system and a.code = m.old_code;

-- 2.2 ย้ายไปเลขใหม่ (ถ้าเลขใหม่ถูกบัญชีที่ตั้งเองใช้อยู่ จะข้ามไป) และเปลี่ยนชื่อให้ตรงชุดใหม่ ถ้ายังเป็นชื่อเดิมของระบบ
update public.accounts a
   set code = m.new_code,
       name_th = case when a.name_th in (select th from (values
                    ('ทุน'), ('กำไร (ขาดทุน) สะสม'), ('รายได้จากการขายและบริการ'), ('ต้นทุนขายและบริการ'),
                    ('ค่าวัสดุสิ้นเปลือง'), ('ค่าเสื่อมราคาสะสม')) x(th)) then m.th else a.name_th end,
       name_en = case when a.name_en in ('Capital', 'Retained earnings', 'Sales and service revenue', 'Cost of sales and services',
                    'Supplies', 'Accumulated depreciation') then m.en else a.name_en end
  from _coa_map m
 where a.code = '~' || m.old_code
   and not exists (select 1 from public.accounts b where b.company_id = a.company_id and b.code = m.new_code);

-- 2.3 ตัวที่ย้ายไม่ได้ กลับไปใช้เลขเดิม
update public.accounts set code = substr(code, 2) where code like '~%';

-- 2.4 ตั้ง role ของบัญชีที่ระบบลงอัตโนมัติให้ถูกเลข (ข้อมูลเดิมมี role ซ้ำ/ผิด: ภาษีถูกหัก ณ ที่จ่าย, ค่าใช้จ่ายค้างจ่าย, ภาษีมูลค่าเพิ่มค้างชำระ)
update public.accounts a set role = r.role
  from (values ('11010','cash'),('11020','bank'),('11040','ar'),('11130','vat_input'),('11140','wht_receivable'),('21030','ap'),('21090','vat_output'),('21110','wht_payable'),('32030','retained_earnings')) r(code, role)
 where a.is_system and a.code = r.code and a.role is distinct from r.role;
update public.accounts a set role = null
 where a.is_system and a.role is not null
   and (a.code, a.role) not in (values ('11010','cash'),('11020','bank'),('11040','ar'),('11130','vat_input'),('11140','wht_receivable'),('21030','ap'),('21090','vat_output'),('21110','wht_payable'),('32030','retained_earnings'))
   and exists (select 1 from public.accounts b where b.company_id = a.company_id and b.role = a.role and b.id <> a.id);

-- 3) เพิ่มบัญชีที่ยังไม่มี ให้ทุกบริษัทที่มีผังบัญชีแล้ว
select public._cw_seed_coa(c.id) from public.companies c
 where exists (select 1 from public.accounts a where a.company_id = c.id);

commit;

-- ตรวจผล: บัญชีมาตรฐานที่ยังใช้เลขชุดเดิม (เลขชุดใหม่ถูกบัญชีที่ตั้งเองใช้อยู่) ถ้าไม่มีแถวแสดงว่าย้ายครบ
select c.name as company, a.code, a.name_th from public.accounts a join public.companies c on c.id = a.company_id
 where a.is_system and a.code not in ('11010', '11020', '11030', '11040', '11050', '11060', '11070', '11080', '11090', '11100', '11110', '11120', '11130', '11140', '12010', '12020', '12030', '12040', '12050', '12060', '12070', '12080', '12090', '12100', '12110', '12120', '12130', '12140', '21010', '21020', '21030', '21040', '21050', '21060', '21070', '21080', '21090', '21100', '21110', '22010', '31010', '31020', '32010', '32020', '32030', '33010', '41010', '41020', '42010', '42020', '42030', '51010', '51020', '52010', '52020', '52030', '53010', '53020', '53030', '53040', '53050', '53060', '53070', '53080', '53090', '53100', '54010', '54020', '55010', '56010') order by 1, 2;
