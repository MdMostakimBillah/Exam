-- ============================================
-- COMPREHENSIVE SEED DATA FOR TESTING
-- Run after fix-rls.sql
-- ============================================
--
-- ADMIN USERS:
-- Auth users must be created via Supabase Auth API (not raw SQL).
-- Run the setup script: npm run setup:super-admin
-- This creates:
--   Super Admin:  superadmin@scholarx.local / qvML&v@FgrRZ$qXkUL1qr@*^0J9068ay
--
-- For institution admin users, register through the /register page.
-- Or create manually in Supabase Dashboard > Auth > Users.
-- ============================================

DO $$
DECLARE
  v_session_id UUID;
  v_exam1_id UUID;
  v_exam2_id UUID;
  v_exam3_id UUID;
  v_inst_id UUID;
  v_inst2_id UUID;
  v_student1_id UUID;
  v_student2_id UUID;
  v_student3_id UUID;
  v_reg1_id UUID;
  v_reg2_id UUID;
  v_reg3_id UUID;
BEGIN
  -- ============================================
  -- 1. ACADEMIC SESSION
  -- ============================================
  SELECT id INTO v_session_id FROM academic_sessions WHERE code = '2024-25' LIMIT 1;
  IF v_session_id IS NULL THEN
    INSERT INTO academic_sessions (name, code, start_date, end_date, is_active, is_current)
    VALUES ('2024-2025', '2024-25', '2024-01-01', '2024-12-31', true, true)
    RETURNING id INTO v_session_id;
  END IF;

  -- ============================================
  -- 2. EXAMS
  -- ============================================
  -- Exam 1: National Talent Scholarship
  SELECT id INTO v_exam1_id FROM exams WHERE code = 'NTSE-2026' LIMIT 1;
  IF v_exam1_id IS NULL THEN
    INSERT INTO exams (session_id, name, code, academic_year, description, registration_start_date, registration_end_date, exam_date, registration_fee, late_fee, classes, subjects, status)
    VALUES (
      v_session_id,
      'National Talent Scholarship Examination 2026',
      'NTSE-2026',
      '2026',
      'National level scholarship examination for talented students across Bangladesh.',
      '2025-10-01',
      '2025-12-15',
      '2026-01-20',
      150,
      50,
      ARRAY['1','2','3','4','5','6','7','8','9','10'],
      '[{"id":"sub1","name":"Mathematics","fullMarks":100,"passMarks":33,"duration":90,"negativeMarks":0.25},{"id":"sub2","name":"Bangla","fullMarks":100,"passMarks":33,"duration":90,"negativeMarks":0.25},{"id":"sub3","name":"English","fullMarks":100,"passMarks":33,"duration":60,"negativeMarks":0.25},{"id":"sub4","name":"Science","fullMarks":100,"passMarks":33,"duration":60,"negativeMarks":0.25}]'::jsonb,
      'OPEN'
    )
    RETURNING id INTO v_exam1_id;
  END IF;

  -- Exam 2: District Merit Scholarship
  SELECT id INTO v_exam2_id FROM exams WHERE code = 'DMS-2026' LIMIT 1;
  IF v_exam2_id IS NULL THEN
    INSERT INTO exams (session_id, name, code, academic_year, description, registration_start_date, registration_end_date, exam_date, registration_fee, late_fee, classes, subjects, status)
    VALUES (
      v_session_id,
      'District Merit Scholarship 2026',
      'DMS-2026',
      '2026',
      'District level merit-based scholarship examination.',
      '2025-11-01',
      '2026-01-15',
      '2026-02-15',
      100,
      30,
      ARRAY['3','4','5','6','7','8'],
      '[{"id":"sub5","name":"Mathematics","fullMarks":100,"passMarks":33,"duration":90,"negativeMarks":0.25},{"id":"sub6","name":"Bangla","fullMarks":100,"passMarks":33,"duration":90,"negativeMarks":0.25},{"id":"sub7","name":"Science","fullMarks":100,"passMarks":33,"duration":60,"negativeMarks":0.25}]'::jsonb,
      'OPEN'
    )
    RETURNING id INTO v_exam2_id;
  END IF;

  -- Exam 3: Primary Education Scholarship Test
  SELECT id INTO v_exam3_id FROM exams WHERE code = 'PEST-2026' LIMIT 1;
  IF v_exam3_id IS NULL THEN
    INSERT INTO exams (session_id, name, code, academic_year, description, registration_start_date, registration_end_date, exam_date, registration_fee, late_fee, classes, subjects, status)
    VALUES (
      v_session_id,
      'Primary Education Scholarship Test 2026',
      'PEST-2026',
      '2026',
      'Scholarship examination for primary education students.',
      '2025-12-01',
      '2026-02-28',
      '2026-03-15',
      75,
      25,
      ARRAY['1','2','3','4','5'],
      '[{"id":"sub8","name":"Mathematics","fullMarks":50,"passMarks":17,"duration":60,"negativeMarks":0},{"id":"sub9","name":"Bangla","fullMarks":50,"passMarks":17,"duration":60,"negativeMarks":0}]'::jsonb,
      'OPEN'
    )
    RETURNING id INTO v_exam3_id;
  END IF;

  -- ============================================
  -- 3. INSTITUTIONS
  -- ============================================
  -- Institution 1: Dhaka Model Madrasa
  SELECT id INTO v_inst_id FROM institutions WHERE code = 'INST-DM001' LIMIT 1;
  IF v_inst_id IS NULL THEN
    INSERT INTO institutions (name, code, slug, email, phone, address, city, district, contact_person, contact_person_phone, status, total_students, total_applications)
    VALUES (
      'Dhaka Model Madrasa',
      'INST-DM001',
      'dhaka-model-madrasa',
      'admin@dhakamodel.edu',
      '+8801712345678',
      '42 Mirpur Road, Dhanmondi',
      'Dhaka',
      'Dhaka',
      'Maulana Abdul Haq',
      '+8801712345678',
      'ACTIVE',
      0,
      0
    )
    RETURNING id INTO v_inst_id;
  END IF;

  -- Institution 2: Chittagong Islamic Academy
  SELECT id INTO v_inst2_id FROM institutions WHERE code = 'INST-CIA001' LIMIT 1;
  IF v_inst2_id IS NULL THEN
    INSERT INTO institutions (name, code, slug, email, phone, address, city, district, contact_person, contact_person_phone, status, total_students, total_applications)
    VALUES (
      'Chittagong Islamic Academy',
      'INST-CIA001',
      'chittagong-islamic-academy',
      'info@ciacademy.edu',
      '+8801812345679',
      '15 Agrabad, Chittagong',
      'Chittagong',
      'Chittagong',
      'Sheikh Mohammad Nur',
      '+8801812345679',
      'ACTIVE',
      0,
      0
    )
    RETURNING id INTO v_inst2_id;
  END IF;

  -- ============================================
  -- 4. STUDENTS
  -- ============================================
  -- Student 1: Mohammad Rahman (Dhaka Model, Class 5)
  SELECT id INTO v_student1_id FROM students WHERE student_id = 'STU-2024-0001' LIMIT 1;
  IF v_student1_id IS NULL THEN
    INSERT INTO students (institution_id, session_id, first_name, last_name, student_id, class, section, roll, date_of_birth, gender, father_name, mother_name, phone, address, status)
    VALUES (v_inst_id, v_session_id, 'Mohammad', 'Rahman', 'STU-2024-0001', '5', 'A', '01', '2013-05-15', 'MALE', 'Abdul Rahman', 'Amina Khatun', '01711111111', 'Dhanmondi, Dhaka', 'ACTIVE')
    RETURNING id INTO v_student1_id;
  END IF;

  -- Student 2: Fatima Khatun (Dhaka Model, Class 5)
  SELECT id INTO v_student2_id FROM students WHERE student_id = 'STU-2024-0002' LIMIT 1;
  IF v_student2_id IS NULL THEN
    INSERT INTO students (institution_id, session_id, first_name, last_name, student_id, class, section, roll, date_of_birth, gender, father_name, mother_name, phone, address, status)
    VALUES (v_inst_id, v_session_id, 'Fatima', 'Khatun', 'STU-2024-0002', '5', 'A', '02', '2013-08-22', 'FEMALE', 'Nurul Huda', 'Rashida Begum', '01722222222', 'Mirpur, Dhaka', 'ACTIVE')
    RETURNING id INTO v_student2_id;
  END IF;

  -- Student 3: Ahmed Hassan (Chittagong, Class 3)
  SELECT id INTO v_student3_id FROM students WHERE student_id = 'STU-2024-0003' LIMIT 1;
  IF v_student3_id IS NULL THEN
    INSERT INTO students (institution_id, session_id, first_name, last_name, student_id, class, section, roll, date_of_birth, gender, father_name, mother_name, phone, address, status)
    VALUES (v_inst2_id, v_session_id, 'Ahmed', 'Hassan', 'STU-2024-0003', '3', 'B', '05', '2015-03-10', 'MALE', 'Hassan Ali', 'Fatema Begum', '01733333333', 'Agrabad, Chittagong', 'ACTIVE')
    RETURNING id INTO v_student3_id;
  END IF;

  -- ============================================
  -- 5. REGISTRATIONS
  -- ============================================
  -- Registration 1: Mohammad Rahman for NTSE (APPROVED, payment submitted)
  SELECT id INTO v_reg1_id FROM registrations WHERE student_id = v_student1_id AND exam_id = v_exam1_id LIMIT 1;
  IF v_reg1_id IS NULL THEN
    INSERT INTO registrations (session_id, application_id, registration_number, student_id, student_name, institution_id, institution_name, exam_id, exam_name, class_name, status, payment_status, student_payment_status, payment_amount)
    VALUES (v_session_id, 'APP-2024-25-0001', '2024000001', v_student1_id, 'Mohammad Rahman', v_inst_id, 'Dhaka Model Madrasa', v_exam1_id, 'National Talent Scholarship Examination 2026', '5', 'APPROVED', 'CONFIRMED', 'VERIFIED', 150)
    RETURNING id INTO v_reg1_id;
  END IF;

  -- Registration 2: Fatima Khatun for NTSE (PENDING, not submitted)
  SELECT id INTO v_reg2_id FROM registrations WHERE student_id = v_student2_id AND exam_id = v_exam1_id LIMIT 1;
  IF v_reg2_id IS NULL THEN
    INSERT INTO registrations (session_id, application_id, registration_number, student_id, student_name, institution_id, institution_name, exam_id, exam_name, class_name, status, payment_status, student_payment_status, payment_amount)
    VALUES (v_session_id, 'APP-2024-25-0002', '2024000002', v_student2_id, 'Fatima Khatun', v_inst_id, 'Dhaka Model Madrasa', v_exam1_id, 'National Talent Scholarship Examination 2026', '5', 'PENDING', 'PENDING', 'NOT_SUBMITTED', 150)
    RETURNING id INTO v_reg2_id;
  END IF;

  -- Registration 3: Fatima Khatun for DMS (SUBMITTED, awaiting verification)
  SELECT id INTO v_reg3_id FROM registrations WHERE student_id = v_student2_id AND exam_id = v_exam2_id LIMIT 1;
  IF v_reg3_id IS NULL THEN
    INSERT INTO registrations (session_id, application_id, registration_number, student_id, student_name, institution_id, institution_name, exam_id, exam_name, class_name, status, payment_status, student_payment_status, payment_amount)
    VALUES (v_session_id, 'APP-2024-25-0003', '2024000003', v_student2_id, 'Fatima Khatun', v_inst_id, 'Dhaka Model Madrasa', v_exam2_id, 'District Merit Scholarship 2026', '5', 'PENDING', 'PENDING', 'SUBMITTED', 100)
    RETURNING id INTO v_reg3_id;
  END IF;

  -- ============================================
  -- 6. PAYMENTS (institution-level + student-submitted)
  -- ============================================
  -- Payment 1: Institution payment for Mohammad Rahman
  IF NOT EXISTS (SELECT 1 FROM payments WHERE registration_id = v_reg1_id AND submitted_by_student = false) THEN
    INSERT INTO payments (session_id, transaction_id, institution_id, institution_name, exam_id, exam_name, student_count, amount, payment_method, status, date, registration_id, student_id, student_name, reference, notes)
    VALUES (v_session_id, 'TXN-INST-001', v_inst_id, 'Dhaka Model Madrasa', v_exam1_id, 'National Talent Scholarship Examination 2026', 1, 150, 'BANK_TRANSFER', 'CONFIRMED', '2025-10-15', v_reg1_id, v_student1_id, 'Mohammad Rahman', 'BB-789012', 'Institution bulk payment');
  END IF;

  -- Payment 2: Student-submitted payment for Fatima Khatun (DMS exam)
  IF NOT EXISTS (SELECT 1 FROM payments WHERE registration_id = v_reg3_id AND submitted_by_student = true) THEN
    INSERT INTO payments (session_id, transaction_id, institution_id, institution_name, exam_id, exam_name, student_count, amount, payment_method, status, date, registration_id, student_id, student_name, reference, payment_date, notes, submitted_by_student, submitted_at, receipt_number, account_number)
    VALUES (v_session_id, 'TXN-STU-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-001', v_inst_id, 'Dhaka Model Madrasa', v_exam2_id, 'District Merit Scholarship 2026', 1, 100, 'BKASH', 'PENDING', CURRENT_DATE, v_reg3_id, v_student2_id, 'Fatima Khatun', 'BK-987654', CURRENT_DATE, 'Student payment via bKash', true, NOW(), 'BK-987654', '01712345678');
  END IF;

  -- ============================================
  -- 7. EXAM CENTERS
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM exam_centers WHERE name = 'Dhaka Central Exam Center') THEN
    INSERT INTO exam_centers (session_id, name, address, capacity, allocated)
    VALUES (v_session_id, 'Dhaka Central Exam Center', '123 Motijheel, Dhaka', 200, 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM exam_centers WHERE name = 'Chittagong Exam Center') THEN
    INSERT INTO exam_centers (session_id, name, address, capacity, allocated)
    VALUES (v_session_id, 'Chittagong Exam Center', '45 Agrabad, Chittagong', 150, 0);
  END IF;

  -- ============================================
  -- 8. RESULTS (sample for Mohammad Rahman)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM results WHERE student_id = v_student1_id AND exam_id = v_exam1_id) THEN
    INSERT INTO results (session_id, student_id, student_name, institution_id, institution_name, exam_id, exam_name, class_name, roll, registration_number, subject_marks, total_marks, total_full_marks, percentage, grade, position, pass, scholarship_status, status)
    VALUES (
      v_session_id,
      v_student1_id,
      'Mohammad Rahman',
      v_inst_id,
      'Dhaka Model Madrasa',
      v_exam1_id,
      'National Talent Scholarship Examination 2026',
      '5',
      '01',
      'APP-2024-25-0001',
      '[{"subjectId":"sub1","subjectName":"Mathematics","marks":85,"fullMarks":100},{"subjectId":"sub2","subjectName":"Bangla","marks":78,"fullMarks":100},{"subjectId":"sub3","subjectName":"English","marks":72,"fullMarks":100},{"subjectId":"sub4","subjectName":"Science","marks":88,"fullMarks":100}]'::jsonb,
      323,
      400,
      80.75,
      'A+',
      1,
      true,
      'GENERAL',
      'PUBLISHED'
    );
  END IF;

  -- ============================================
  -- 9. NOTIFICATIONS (sample for testing)
  -- ============================================
  -- Note: Notifications require auth user IDs, so we skip them here
  -- They should be created when actual users log in

  -- ============================================
  -- 10. UPDATE INSTITUTION COUNTS
  -- ============================================
  UPDATE institutions SET
    total_students = (SELECT COUNT(*) FROM students WHERE institution_id = v_inst_id),
    total_applications = (SELECT COUNT(*) FROM registrations WHERE institution_id = v_inst_id)
  WHERE id = v_inst_id;

  UPDATE institutions SET
    total_students = (SELECT COUNT(*) FROM students WHERE institution_id = v_inst2_id),
    total_applications = (SELECT COUNT(*) FROM registrations WHERE institution_id = v_inst2_id)
  WHERE id = v_inst2_id;

  RAISE NOTICE 'Seed data complete!';
  RAISE NOTICE 'Institution 1 (Dhaka Model): %', v_inst_id;
  RAISE NOTICE 'Institution 2 (Chittagong): %', v_inst2_id;
  RAISE NOTICE 'Student 1 (Mohammad): %', v_student1_id;
  RAISE NOTICE 'Student 2 (Fatima): %', v_student2_id;
  RAISE NOTICE 'Student 3 (Ahmed): %', v_student3_id;
  RAISE NOTICE 'Exam 1 (NTSE): %', v_exam1_id;
  RAISE NOTICE 'Exam 2 (DMS): %', v_exam2_id;
  RAISE NOTICE 'Exam 3 (PEST): %', v_exam3_id;

END $$;
