import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface LegacyData {
  institutions: any[];
  students: any[];
  exams: any[];
  registrations: any[];
  results: any[];
  certificates: any[];
  payments: any[];
  examCenters: any[];
  marks: any[];
  admitCards: any[];
  classes: any[];
  notifications: any[];
  auditLogs: any[];
  systemSettings: any[];
  users: any[];
}

async function readLocalStorageData(): Promise<LegacyData> {
  const storagePath = path.join(process.cwd(), '.localStorage.json');
  if (!fs.existsSync(storagePath)) {
    console.log('No localStorage backup found. Skipping migration.');
    return {
      institutions: [], students: [], exams: [], registrations: [],
      results: [], certificates: [], payments: [], examCenters: [],
      marks: [], admitCards: [], classes: [], notifications: [],
      auditLogs: [], systemSettings: [], users: []
    };
  }
  
  const content = fs.readFileSync(storagePath, 'utf-8');
  return JSON.parse(content);
}

async function createLegacySession(): Promise<string> {
  const { data: existing } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('code', 'legacy')
    .single();
  
  if (existing) {
    console.log('Legacy session already exists:', existing.id);
    return existing.id;
  }
  
  const { data, error } = await supabase
    .from('academic_sessions')
    .insert({
      name: 'Legacy Data (Pre-Supabase)',
      code: 'legacy',
      start_date: '2023-01-01',
      end_date: '2023-12-31',
      is_active: false,
      is_current: false,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  console.log('Created legacy session:', data.id);
  return data.id;
}

async function migrateInstitutions(institutions: any[]): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  
  for (const inst of institutions) {
    const { data, error } = await supabase
      .from('institutions')
      .upsert({
        id: inst.id,
        name: inst.name,
        code: inst.code,
        slug: inst.slug,
        email: inst.email,
        phone: inst.phone,
        address: inst.address,
        city: inst.city,
        district: inst.district,
        contact_person: inst.contactPerson,
        contact_person_phone: inst.contactPersonPhone,
        admin_user_id: inst.adminUserId,
        status: inst.status,
        logo_url: inst.logo,
        total_students: inst.totalStudents,
        total_applications: inst.totalApplications,
        created_at: inst.createdAt,
        updated_at: inst.updatedAt,
      }, { onConflict: 'id' })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error migrating institution:', inst.name, error);
      continue;
    }
    idMap.set(inst.id, data.id);
    console.log('Migrated institution:', inst.name);
  }
  return idMap;
}

async function migrateClasses(classes: any[]): Promise<void> {
  for (const cls of classes) {
    const { error } = await supabase
      .from('classes')
      .upsert({
        id: cls.id,
        name: cls.name,
        code: cls.code,
        description: cls.description,
        is_active: cls.isActive,
        created_at: cls.createdAt,
        updated_at: cls.updatedAt,
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error migrating class:', cls.name, error);
    }
  }
  console.log(`Migrated ${classes.length} classes`);
}

async function migrateStudents(students: any[], institutionIdMap: Map<string, string>, sessionId: string): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  
  for (const student of students) {
    const newInstitutionId = institutionIdMap.get(student.institutionId);
    if (!newInstitutionId) {
      console.warn('Institution not found for student:', student.studentId);
      continue;
    }
    
    const { data, error } = await supabase
      .from('students')
      .upsert({
        id: student.id,
        institution_id: newInstitutionId,
        session_id: sessionId,
        first_name: student.firstName,
        last_name: student.lastName,
        student_id: student.studentId,
        class: student.class,
        section: student.section,
        roll: student.roll,
        date_of_birth: student.dateOfBirth,
        gender: student.gender,
        father_name: student.fatherName,
        mother_name: student.motherName,
        phone: student.phone,
        address: student.address,
        photo_url: student.photo,
        status: student.status,
        created_at: student.createdAt,
        updated_at: student.updatedAt,
      }, { onConflict: 'id' })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error migrating student:', student.studentId, error);
      continue;
    }
    idMap.set(student.id, data.id);
  }
  console.log(`Migrated ${idMap.size} students`);
  return idMap;
}

async function migrateExams(exams: any[], sessionId: string): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  
  for (const exam of exams) {
    const { data, error } = await supabase
      .from('exams')
      .upsert({
        id: exam.id,
        session_id: sessionId,
        name: exam.name,
        code: exam.code,
        academic_year: exam.academicYear,
        description: exam.description,
        registration_start_date: exam.registrationStartDate,
        registration_end_date: exam.registrationEndDate,
        exam_date: exam.examDate,
        registration_fee: exam.registrationFee,
        late_fee: exam.lateFee,
        classes: exam.classes,
        subjects: exam.subjects,
        status: exam.status,
        created_at: exam.createdAt,
        updated_at: exam.updatedAt,
      }, { onConflict: 'id' })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error migrating exam:', exam.name, error);
      continue;
    }
    idMap.set(exam.id, data.id);
  }
  console.log(`Migrated ${idMap.size} exams`);
  return idMap;
}

async function migrateRegistrations(registrations: any[], institutionIdMap: Map<string, string>, studentIdMap: Map<string, string>, examIdMap: Map<string, string>, sessionId: string): Promise<void> {
  let count = 0;
  
  for (const reg of registrations) {
    const newInstitutionId = institutionIdMap.get(reg.institutionId);
    const newStudentId = studentIdMap.get(reg.studentId);
    const newExamId = examIdMap.get(reg.examId);
    
    if (!newInstitutionId || !newStudentId || !newExamId) {
      console.warn('Missing reference for registration:', reg.applicationId);
      continue;
    }
    
    const { error } = await supabase
      .from('registrations')
      .upsert({
        id: reg.id,
        session_id: sessionId,
        application_id: reg.applicationId,
        student_id: newStudentId,
        student_name: reg.studentName,
        institution_id: newInstitutionId,
        institution_name: reg.institutionName,
        exam_id: newExamId,
        exam_name: reg.examName,
        class_name: reg.className,
        status: reg.status,
        payment_status: reg.paymentStatus,
        payment_amount: reg.paymentAmount,
        transaction_id: reg.transactionId,
        created_at: reg.createdAt,
        updated_at: reg.updatedAt,
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error migrating registration:', reg.applicationId, error);
      continue;
    }
    count++;
  }
  console.log(`Migrated ${count} registrations`);
}

async function migrateResults(results: any[], institutionIdMap: Map<string, string>, studentIdMap: Map<string, string>, examIdMap: Map<string, string>, sessionId: string): Promise<void> {
  let count = 0;
  
  for (const result of results) {
    const newInstitutionId = institutionIdMap.get(result.institutionId);
    const newStudentId = studentIdMap.get(result.studentId);
    const newExamId = examIdMap.get(result.examId);
    
    if (!newInstitutionId || !newStudentId || !newExamId) {
      console.warn('Missing reference for result:', result.id);
      continue;
    }
    
    const { error } = await supabase
      .from('results')
      .upsert({
        id: result.id,
        session_id: sessionId,
        student_id: newStudentId,
        student_name: result.studentName,
        institution_id: newInstitutionId,
        institution_name: result.institutionName,
        exam_id: newExamId,
        exam_name: result.examName,
        class_name: result.className,
        roll: result.roll,
        registration_number: result.registrationNumber,
        subject_marks: result.subjectMarks,
        total_marks: result.totalMarks,
        total_full_marks: result.totalFullMarks,
        percentage: result.percentage,
        grade: result.grade,
        position: result.position,
        pass: result.pass,
        scholarship_status: result.scholarshipStatus,
        status: result.status,
        created_at: result.createdAt,
        updated_at: result.updatedAt,
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error migrating result:', result.id, error);
      continue;
    }
    count++;
  }
  console.log(`Migrated ${count} results`);
}

async function migrateCertificates(certificates: any[], institutionIdMap: Map<string, string>, studentIdMap: Map<string, string>, examIdMap: Map<string, string>, sessionId: string): Promise<void> {
  let count = 0;
  
  for (const cert of certificates) {
    const newInstitutionId = institutionIdMap.get(cert.institutionId);
    const newStudentId = studentIdMap.get(cert.studentId);
    const newExamId = examIdMap.get(cert.examId);
    
    if (!newInstitutionId || !newStudentId || !newExamId) {
      console.warn('Missing reference for certificate:', cert.certificateNumber);
      continue;
    }
    
    const { error } = await supabase
      .from('certificates')
      .upsert({
        id: cert.id,
        session_id: sessionId,
        certificate_number: cert.certificateNumber,
        student_id: newStudentId,
        student_name: cert.studentName,
        institution_id: newInstitutionId,
        institution_name: cert.institutionName,
        exam_id: newExamId,
        exam_name: cert.examName,
        class_name: cert.className,
        position: cert.position,
        total_marks: cert.totalMarks,
        exam_year: cert.examYear,
        issue_date: cert.issueDate,
        result_id: cert.resultId,
        qr_code: cert.qrCode,
        status: cert.status,
        created_at: cert.createdAt,
        updated_at: cert.updatedAt,
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error migrating certificate:', cert.certificateNumber, error);
      continue;
    }
    count++;
  }
  console.log(`Migrated ${count} certificates`);
}

async function migratePayments(payments: any[], institutionIdMap: Map<string, string>, examIdMap: Map<string, string>, sessionId: string): Promise<void> {
  let count = 0;
  
  for (const payment of payments) {
    const newInstitutionId = institutionIdMap.get(payment.institutionId);
    const newExamId = examIdMap.get(payment.examId);
    
    if (!newInstitutionId || !newExamId) {
      console.warn('Missing reference for payment:', payment.transactionId);
      continue;
    }
    
    const { error } = await supabase
      .from('payments')
      .upsert({
        id: payment.id,
        session_id: sessionId,
        transaction_id: payment.transactionId,
        institution_id: newInstitutionId,
        institution_name: payment.institutionName,
        exam_id: newExamId,
        exam_name: payment.examName,
        student_count: payment.studentCount,
        amount: payment.amount,
        payment_method: payment.paymentMethod,
        status: payment.status,
        date: payment.date,
        registration_id: payment.registrationId,
        student_id: payment.studentId,
        student_name: payment.studentName,
        reference: payment.reference,
        payment_date: payment.paymentDate,
        notes: payment.notes,
        created_at: payment.createdAt,
        updated_at: payment.updatedAt,
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error migrating payment:', payment.transactionId, error);
      continue;
    }
    count++;
  }
  console.log(`Migrated ${count} payments`);
}

async function migrateExamCenters(centers: any[], institutionIdMap: Map<string, string>, sessionId: string): Promise<void> {
  let count = 0;
  
  for (const center of centers) {
    let newInstitutionId: string | undefined;
    if (center.institutionId) {
      newInstitutionId = institutionIdMap.get(center.institutionId);
    }
    
    const { error } = await supabase
      .from('exam_centers')
      .upsert({
        id: center.id,
        session_id: sessionId,
        name: center.name,
        address: center.address,
        capacity: center.capacity,
        allocated: center.allocated,
        institution_id: newInstitutionId,
        created_at: center.createdAt,
        updated_at: center.updatedAt,
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error migrating exam center:', center.name, error);
      continue;
    }
    count++;
  }
  console.log(`Migrated ${count} exam centers`);
}

async function main() {
  console.log('Starting legacy data migration...');
  
  const legacyData = await readLocalStorageData();
  
  const sessionId = await createLegacySession();
  
  const institutionIdMap = await migrateInstitutions(legacyData.institutions);
  await migrateClasses(legacyData.classes);
  const studentIdMap = await migrateStudents(legacyData.students, institutionIdMap, sessionId);
  const examIdMap = await migrateExams(legacyData.exams, sessionId);
  await migrateRegistrations(legacyData.registrations, institutionIdMap, studentIdMap, examIdMap, sessionId);
  await migrateResults(legacyData.results, institutionIdMap, studentIdMap, examIdMap, sessionId);
  await migrateCertificates(legacyData.certificates, institutionIdMap, studentIdMap, examIdMap, sessionId);
  await migratePayments(legacyData.payments, institutionIdMap, examIdMap, sessionId);
  await migrateExamCenters(legacyData.examCenters, institutionIdMap, sessionId);
  
  console.log('Migration completed!');
}

main().catch(console.error);