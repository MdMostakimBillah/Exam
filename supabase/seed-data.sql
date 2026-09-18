-- ============================================
-- SEED DATA FOR TESTING
-- Run after fix-all.sql
-- ============================================

-- Get current session ID
DO $$
DECLARE
  v_session_id UUID;
  v_exam_id UUID;
  v_inst_id UUID;
  v_student1_id UUID;
  v_student2_id UUID;
  v_reg1_id UUID;
  v_reg2_id UUID;
BEGIN
  -- Get or create current session
  SELECT id INTO v_session_id FROM academic_sessions WHERE is_current = true LIMIT 1;
  IF v_session_id IS NULL THEN
    INSERT INTO academic_sessions (name, code, start_date, end_date, is_active, is_current)
    VALUES ('2024-2025', '2024-25', '2024-01-01', '2024-12-31', true, true)
    RETURNING id INTO v_session_id;
  END IF;

  -- Create demo exam if not exists
  SELECT id INTO v_exam_id FROM exams WHERE code = 'NTSE-2026' LIMIT 1;
  IF v_exam_id IS NULL THEN
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
      ARRAY['1','2','3','4','5'],
      '[{"id":"sub1","name":"Mathematics","fullMarks":100,"passMarks":33,"duration":90,"negativeMarks":0.25},{"id":"sub2","name":"Bangla","fullMarks":100,"passMarks":33,"duration":90,"negativeMarks":0.25},{"id":"sub3","name":"English","fullMarks":100,"passMarks":33,"duration":60,"negativeMarks":0.25},{"id":"sub4","name":"Science","fullMarks":100,"passMarks":33,"duration":60,"negativeMarks":0.25}]'::jsonb,
      'OPEN'
    )
    RETURNING id INTO v_exam_id;
  END IF;

  -- Create demo exam 2
  IF NOT EXISTS (SELECT 1 FROM exams WHERE code = 'DMS-2026') THEN
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
      ARRAY['3','4','5'],
      '[{"id":"sub5","name":"Mathematics","fullMarks":100,"passMarks":33,"duration":90,"negativeMarks":0.25},{"id":"sub6","name":"Bangla","fullMarks":100,"passMarks":33,"duration":90,"negativeMarks":0.25},{"id":"sub7","name":"Science","fullMarks":100,"passMarks":33,"duration":60,"negativeMarks":0.25}]'::jsonb,
      'OPEN'
    );
  END IF;

  -- Create demo exam 3
  IF NOT EXISTS (SELECT 1 FROM exams WHERE code = 'PEST-2026') THEN
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
      ARRAY['1','2','3'],
      '[{"id":"sub8","name":"Mathematics","fullMarks":50,"passMarks":17,"duration":60,"negativeMarks":0},{"id":"sub9","name":"Bangla","fullMarks":50,"passMarks":17,"duration":60,"negativeMarks":0}]'::jsonb,
      'OPEN'
    );
  END IF;

  -- Create demo institution (if no institutions exist)
  SELECT id INTO v_inst_id FROM institutions LIMIT 1;
  IF v_inst_id IS NULL THEN
    INSERT INTO institutions (name, code, slug, email, phone, address, status, total_students, total_applications)
    VALUES (
      'Dhaka Model Madrasa',
      'INST-DM001',
      'dhaka-model-madrasa',
      'admin@dhakamodel.edu',
      '+8801712345678',
      'Dhanmondi, Dhaka',
      'ACTIVE',
      0,
      0
    )
    RETURNING id INTO v_inst_id;
  END IF;

  -- Create demo students
  SELECT id INTO v_student1_id FROM students WHERE student_id = 'STU-2024-0001' LIMIT 1;
  IF v_student1_id IS NULL THEN
    INSERT INTO students (institution_id, session_id, first_name, last_name, student_id, class, section, roll, gender, phone, status)
    VALUES (v_inst_id, v_session_id, 'Mohammad', 'Rahman', 'STU-2024-0001', '5', 'A', '01', 'MALE', '01711111111', 'ACTIVE')
    RETURNING id INTO v_student1_id;
  END IF;

  SELECT id INTO v_student2_id FROM students WHERE student_id = 'STU-2024-0002' LIMIT 1;
  IF v_student2_id IS NULL THEN
    INSERT INTO students (institution_id, session_id, first_name, last_name, student_id, class, section, roll, gender, phone, status)
    VALUES (v_inst_id, v_session_id, 'Fatima', 'Khatun', 'STU-2024-0002', '5', 'A', '02', 'FEMALE', '01722222222', 'ACTIVE')
    RETURNING id INTO v_student2_id;
  END IF;

  -- Create demo registrations
  SELECT id INTO v_reg1_id FROM registrations WHERE student_id = v_student1_id AND exam_id = v_exam_id LIMIT 1;
  IF v_reg1_id IS NULL THEN
    INSERT INTO registrations (session_id, application_id, student_id, student_name, institution_id, institution_name, exam_id, exam_name, class_name, status, payment_status, student_payment_status, payment_amount)
    VALUES (v_session_id, 'APP-2024-25-0001', v_student1_id, 'Mohammad Rahman', v_inst_id, 'Dhaka Model Madrasa', v_exam_id, 'National Talent Scholarship Examination 2026', '5', 'APPROVED', 'CONFIRMED', 'NOT_SUBMITTED', 150)
    RETURNING id INTO v_reg1_id;
  END IF;

  SELECT id INTO v_reg2_id FROM registrations WHERE student_id = v_student2_id AND exam_id = v_exam_id LIMIT 1;
  IF v_reg2_id IS NULL THEN
    INSERT INTO registrations (session_id, application_id, student_id, student_name, institution_id, institution_name, exam_id, exam_name, class_name, status, payment_status, student_payment_status, payment_amount)
    VALUES (v_session_id, 'APP-2024-25-0002', v_student2_id, 'Fatima Khatun', v_inst_id, 'Dhaka Model Madrasa', v_exam_id, 'National Talent Scholarship Examination 2026', '5', 'PENDING', 'PENDING', 'NOT_SUBMITTED', 150)
    RETURNING id INTO v_reg2_id;
  END IF;

  -- Create demo payment
  IF NOT EXISTS (SELECT 1 FROM payments WHERE registration_id = v_reg1_id) THEN
    INSERT INTO payments (session_id, transaction_id, institution_id, institution_name, exam_id, exam_name, student_count, amount, payment_method, status, date, registration_id, student_id, student_name, reference, notes)
    VALUES (v_session_id, 'TXN-DEMO-001', v_inst_id, 'Dhaka Model Madrasa', v_exam_id, 'National Talent Scholarship Examination 2026', 1, 150, 'Bkash', 'CONFIRMED', '2025-10-15', v_reg1_id, v_student1_id, 'Mohammad Rahman', 'BK-123456', 'Registration fee payment');
  END IF;

  -- Update institution counts
  UPDATE institutions SET
    total_students = (SELECT COUNT(*) FROM students WHERE institution_id = v_inst_id),
    total_applications = (SELECT COUNT(*) FROM registrations WHERE institution_id = v_inst_id)
  WHERE id = v_inst_id;

END $$;
