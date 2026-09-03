import { User, Institution, Student, Exam, Registration, Result, Certificate, Payment, Notification, AuditLog, ExamCenter, AdmitCard, Mark } from '../types';
import { setStore } from './storage';

const USER_KEY = 'users';
const INST_KEY = 'institutions';
const STUD_KEY = 'students';
const EXAM_KEY = 'exams';
const REG_KEY = 'registrations';
const RES_KEY = 'results';
const CERT_KEY = 'certificates';
const PAY_KEY = 'payments';
const NOTIF_KEY = 'notifications';
const AUDIT_KEY = 'audit_logs';
const CENTER_KEY = 'exam_centers';
const ADMIT_KEY = 'admit_cards';
const MARK_KEY = 'marks';
const INIT_KEY = 'initialized';

export function isInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('scholarx_' + INIT_KEY) === 'true';
}

export function markInitialized(): void {
  localStorage.setItem('scholarx_' + INIT_KEY, 'true');
}

export function initializeDemoData(): void {
  if (isInitialized()) return;

  // Users
  const users: User[] = [
    { id: 'u1', email: 'admin@scholarx.local', name: 'Super Admin', role: 'SUPER_ADMIN', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
    { id: 'u2', email: 'institution@scholarx.local', name: 'Rahim Ahmed', role: 'INSTITUTION_ADMIN', institutionId: 'i1', createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-01-15T00:00:00Z' },
    { id: 'u3', email: 'student@scholarx.local', name: 'Fatima Khan', role: 'STUDENT', institutionId: 'i1', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
    { id: 'u4', email: 'admin@dhaka-academy.bd', name: 'Nusrat Jahan', role: 'INSTITUTION_ADMIN', institutionId: 'i2', createdAt: '2025-01-20T00:00:00Z', updatedAt: '2025-01-20T00:00:00Z' },
    { id: 'u5', email: 'admin@barisal-school.bd', name: 'Kamal Hossain', role: 'INSTITUTION_ADMIN', institutionId: 'i3', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
  ];

  // Institutions
  const institutions: Institution[] = [
    { id: 'i1', name: 'Dhaka International Academy', code: 'DIA-001', slug: 'dhaka-international-academy', email: 'info@dia.edu.bd', phone: '+880-2-9876543', address: '45 Mirpur Road, Dhaka', city: 'Dhaka', district: 'Dhaka', contactPerson: 'Rahim Ahmed', contactPersonPhone: '+880-1712345678', adminUserId: 'u2', status: 'ACTIVE', totalStudents: 450, totalApplications: 120, createdAt: '2025-01-10T00:00:00Z', updatedAt: '2025-01-10T00:00:00Z' },
    { id: 'i2', name: 'Dhaka Model School', code: 'DMS-002', slug: 'dhaka-model-school', email: 'contact@dhaka-model.edu.bd', phone: '+880-2-8765432', address: '78 Elephant Road, Dhaka', city: 'Dhaka', district: 'Dhaka', contactPerson: 'Nusrat Jahan', contactPersonPhone: '+880-1812345678', adminUserId: 'u4', status: 'ACTIVE', totalStudents: 380, totalApplications: 95, createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-01-15T00:00:00Z' },
    { id: 'i3', name: 'Barisal Government School', code: 'BGS-003', slug: 'barisal-government-school', email: 'info@bgs.edu.bd', phone: '+880-431-654321', address: '12 Sadar Road, Barisal', city: 'Barisal', district: 'Barisal', contactPerson: 'Kamal Hossain', contactPersonPhone: '+880-1912345678', adminUserId: 'u5', status: 'ACTIVE', totalStudents: 320, totalApplications: 80, createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
    { id: 'i4', name: 'Chittagong Grammar School', code: 'CGS-004', slug: 'chittagong-grammar-school', email: 'admin@cgs.edu.bd', phone: '+880-31-7654321', address: '56 Agrabad, Chittagong', city: 'Chittagong', district: 'Chittagong', contactPerson: 'Arif Rahman', contactPersonPhone: '+880-1612345678', status: 'ACTIVE', totalStudents: 290, totalApplications: 70, createdAt: '2025-02-10T00:00:00Z', updatedAt: '2025-02-10T00:00:00Z' },
    { id: 'i5', name: 'Rajshahi Cadet Academy', code: 'RCA-005', slug: 'rajshahi-cadet-academy', email: 'info@rca.edu.bd', phone: '+880-721-543210', address: '89 Kazla, Rajshahi', city: 'Rajshahi', district: 'Rajshahi', contactPerson: 'Shafiqul Islam', contactPersonPhone: '+880-1512345678', status: 'ACTIVE', totalStudents: 260, totalApplications: 65, createdAt: '2025-02-15T00:00:00Z', updatedAt: '2025-02-15T00:00:00Z' },
    { id: 'i6', name: 'Sylhet Public School', code: 'SPS-006', slug: 'sylhet-public-school', email: 'admin@sps.edu.bd', phone: '+880-821-432109', address: '34 Zindabazar, Sylhet', city: 'Sylhet', district: 'Sylhet', contactPerson: 'Farida Begum', contactPersonPhone: '+880-1712345679', status: 'PENDING', totalStudents: 0, totalApplications: 0, createdAt: '2025-03-01T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z' },
    { id: 'i7', name: 'Khulna Divisional School', code: 'KDS-007', slug: 'khulna-divisional-school', email: 'info@kds.edu.bd', phone: '+880-41-321098', address: '67 Daulatpur, Khulna', city: 'Khulna', district: 'Khulna', contactPerson: 'Abdur Rashid', contactPersonPhone: '+880-1812345679', status: 'ACTIVE', totalStudents: 210, totalApplications: 55, createdAt: '2025-03-05T00:00:00Z', updatedAt: '2025-03-05T00:00:00Z' },
    { id: 'i8', name: 'Rangpur Elite Academy', code: 'REA-008', slug: 'rangpur-elite-academy', email: 'admin@rea.edu.bd', phone: '+880-521-210987', address: '23 Station Road, Rangpur', city: 'Rangpur', district: 'Rangpur', contactPerson: 'Mobin Uddin', contactPersonPhone: '+880-1912345679', status: 'ACTIVE', totalStudents: 180, totalApplications: 45, createdAt: '2025-03-10T00:00:00Z', updatedAt: '2025-03-10T00:00:00Z' },
    { id: 'i9', name: 'Comilla Baptist School', code: 'CBS-009', slug: 'comilla-baptist-school', email: 'info@cbs.edu.bd', phone: '+880-81-109876', address: '45 Laksam Road, Comilla', city: 'Comilla', district: 'Comilla', contactPerson: 'Sumon Das', contactPersonPhone: '+880-1712345680', status: 'SUSPENDED', totalStudents: 150, totalApplications: 30, createdAt: '2025-03-15T00:00:00Z', updatedAt: '2025-03-15T00:00:00Z' },
    { id: 'i10', name: 'Mymensingh High School', code: 'MHS-010', slug: 'mymensingh-high-school', email: 'admin@mhs.edu.bd', phone: '+880-91-098765', address: '78 Charpara, Mymensingh', city: 'Mymensingh', district: 'Mymensingh', contactPerson: 'Jamal Mia', contactPersonPhone: '+880-1812345680', status: 'PENDING', totalStudents: 0, totalApplications: 0, createdAt: '2025-03-20T00:00:00Z', updatedAt: '2025-03-20T00:00:00Z' },
  ];

  // Students (40+ across institutions)
  const studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const banglaNames = [
    { first: 'Fatima', last: 'Khan' }, { first: 'Rahim', last: 'Uddin' }, { first: 'Nusrat', last: 'Jahan' },
    { first: 'Kamal', last: 'Hossain' }, { first: 'Farida', last: 'Begum' }, { first: 'Arif', last: 'Rahman' },
    { first: 'Shafiqul', last: 'Islam' }, { first: 'Mobin', last: 'Uddin' }, { first: 'Sumon', last: 'Das' },
    { first: 'Jamal', last: 'Mia' }, { first: 'Taslima', last: 'Akter' }, { first: 'Anwar', last: 'Hossain' },
    { first: 'Shirin', last: 'Sultana' }, { first: 'Nazrul', last: 'Islam' }, { first: 'Rokeya', last: 'Begum' },
    { first: 'Helal', last: 'Uddin' }, { first: 'Sumaiya', last: 'Khatun' }, { first: 'Bashir', last: 'Ahmed' },
    { first: 'Nargis', last: 'Akhter' }, { first: 'Sohel', last: 'Rana' }, { first: 'Mst.', last: 'Rahima' },
    { first: 'Kazi', last: 'Tanvir' }, { first: 'Sabrina', last: 'Yasmin' }, { first: 'Rakibul', last: 'Hasan' },
    { first: 'Tahsin', last: 'Fahmida' }, { first: 'Zahid', last: 'Hassan' }, { first: 'Maliha', last: 'Islam' },
    { first: 'Imran', last: 'Hossain' }, { first: 'Priyanka', last: 'Debnath' }, { first: 'Sakib', last: 'Al Hasan' },
    { first: 'Jannatul', last: 'Mawa' }, { first: 'Tamim', last: 'Iqbal' }, { first: 'Afia', last: 'NUSRAT' },
    { first: 'Mehedi', last: 'Hasan' }, { first: 'Tanzila', last: 'Nabi' }, { first: 'Mominul', last: 'Haque' },
    { first: 'Rumana', last: 'Parvin' }, { first: 'Mahmudullah', last: 'Riyad' }, { first: 'Sanjida', last: 'Akter' },
    { first: 'Mushfiqur', last: 'Rahim' }, { first: 'Shamima', last: 'Begum' }, { first: 'Liton', last: 'Kumar' },
    { first: 'Rabeya', last: 'Khatun' }, { first: 'Sabbir', last: 'Rahman' }, { first: 'Nasima', last: 'Akhter' },
  ];

  const classes = ['Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7'];
  const sections = ['A', 'B', 'C'];
  const instIds = ['i1', 'i2', 'i3', 'i4', 'i5', 'i7', 'i8'];
  const genders: ('MALE' | 'FEMALE')[] = ['MALE', 'FEMALE'];

  banglaNames.forEach((name, idx) => {
    const instId = instIds[idx % instIds.length];
    const cls = classes[idx % classes.length];
    const sec = sections[idx % sections.length];
    studentData.push({
      institutionId: instId,
      firstName: name.first,
      lastName: name.last,
      studentId: `STU-${String(2026000 + idx + 1).padStart(7, '0')}`,
      class: cls,
      section: sec,
      roll: String((idx % 40) + 1),
      dateOfBirth: `${2012 - (idx % 7)}-${String((idx % 12) + 1).padStart(2, '0')}-${String((idx % 28) + 1).padStart(2, '0')}`,
      gender: name.first === 'Fatima' || name.first === 'Nusrat' || name.first === 'Farida' || name.first === 'Taslima' || name.first === 'Shirin' || name.first === 'Rokeya' || name.first === 'Sumaiya' || name.first === 'Nargis' || name.first === 'Sabrina' || name.first === 'Tahsin' || name.first === 'Maliha' || name.first === 'Jannatul' || name.first === 'Afia' || name.first === 'Tanzila' || name.first === 'Rumana' || name.first === 'Sanjida' || name.first === 'Shamima' || name.first === 'Rabeya' || name.first === 'Nasima' || name.first === 'Priyanka' ? 'FEMALE' : 'MALE',
      fatherName: `Father of ${name.first} ${name.last}`,
      motherName: `Mother of ${name.first} ${name.last}`,
      phone: `+880-1${String(710000000 + idx * 111111).slice(0, 10)}`,
      address: `${idx + 10} Road ${idx + 1}, Dhaka`,
      status: 'ACTIVE',
    });
  });

  const students: Student[] = studentData.map((s, i) => ({
    ...s,
    id: `s${i + 1}`,
    createdAt: `2025-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    updatedAt: `2025-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  }));

  // Exams
  const exams: Exam[] = [
    {
      id: 'e1', name: 'National Talent Scholarship Examination 2026', code: 'NTSE-2026',
      academicYear: '2026', description: 'National level scholarship examination for talented students across Bangladesh.',
      registrationStartDate: '2025-10-01T00:00:00Z', registrationEndDate: '2025-12-15T00:00:00Z',
      examDate: '2026-01-20T00:00:00Z', registrationFee: 150, lateFee: 50,
      classes: ['Class 3', 'Class 4', 'Class 5', 'Class 6'],
      subjects: [
        { id: 'sub1', name: 'Mathematics', fullMarks: 100, passMarks: 33, duration: 90, negativeMarks: 0.25 },
        { id: 'sub2', name: 'Bangla', fullMarks: 100, passMarks: 33, duration: 90, negativeMarks: 0.25 },
        { id: 'sub3', name: 'English', fullMarks: 100, passMarks: 33, duration: 60, negativeMarks: 0.25 },
        { id: 'sub4', name: 'Science', fullMarks: 100, passMarks: 33, duration: 60, negativeMarks: 0.25 },
      ],
      status: 'PUBLISHED', createdAt: '2025-09-15T00:00:00Z', updatedAt: '2025-09-15T00:00:00Z',
    },
    {
      id: 'e2', name: 'District Merit Scholarship 2026', code: 'DMS-2026',
      academicYear: '2026', description: 'District level merit-based scholarship examination.',
      registrationStartDate: '2025-11-01T00:00:00Z', registrationEndDate: '2026-01-15T00:00:00Z',
      examDate: '2026-02-15T00:00:00Z', registrationFee: 100, lateFee: 30,
      classes: ['Class 5', 'Class 6', 'Class 7'],
      subjects: [
        { id: 'sub5', name: 'Mathematics', fullMarks: 100, passMarks: 33, duration: 90, negativeMarks: 0.25 },
        { id: 'sub6', name: 'Bangla', fullMarks: 100, passMarks: 33, duration: 90, negativeMarks: 0.25 },
        { id: 'sub7', name: 'Science', fullMarks: 100, passMarks: 33, duration: 60, negativeMarks: 0.25 },
      ],
      status: 'OPEN', createdAt: '2025-10-20T00:00:00Z', updatedAt: '2025-10-20T00:00:00Z',
    },
    {
      id: 'e3', name: 'Primary Education Scholarship Test 2026', code: 'PEST-2026',
      academicYear: '2026', description: 'Scholarship examination for primary education students.',
      registrationStartDate: '2025-12-01T00:00:00Z', registrationEndDate: '2026-02-28T00:00:00Z',
      examDate: '2026-03-15T00:00:00Z', registrationFee: 75, lateFee: 25,
      classes: ['Class 3', 'Class 4', 'Class 5'],
      subjects: [
        { id: 'sub8', name: 'Mathematics', fullMarks: 50, passMarks: 17, duration: 60, negativeMarks: 0 },
        { id: 'sub9', name: 'Bangla', fullMarks: 50, passMarks: 17, duration: 60, negativeMarks: 0 },
      ],
      status: 'OPEN', createdAt: '2025-11-25T00:00:00Z', updatedAt: '2025-11-25T00:00:00Z',
    },
  ];

  // Registrations
  const registrations: Registration[] = [];
  let regCount = 0;
  students.forEach(student => {
    if (regCount >= 100) return;
    if (student.institutionId === 'i1' || student.institutionId === 'i2' || student.institutionId === 'i3') {
      const examIdx = regCount % 3;
      const exam = exams[examIdx];
      regCount++;
      registrations.push({
        id: `r${regCount}`,
        applicationId: `APP-2026-${String(regCount).padStart(4, '0')}`,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        institutionId: student.institutionId,
        institutionName: institutions.find(i => i.id === student.institutionId)?.name || '',
        examId: exam.id,
        examName: exam.name,
        className: student.class,
        status: regCount <= 60 ? 'APPROVED' : regCount <= 80 ? 'VERIFIED' : 'PENDING',
        paymentStatus: regCount <= 60 ? 'PAID' : regCount <= 80 ? 'PAID' : 'PENDING',
        paymentAmount: exam.registrationFee,
        transactionId: regCount <= 80 ? `TXN${Date.now().toString(36).toUpperCase()}${regCount}` : undefined,
        createdAt: `2025-${String(Math.min(12, 3 + Math.floor(regCount / 15))).padStart(2, '0')}-${String((regCount % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        updatedAt: `2025-${String(Math.min(12, 3 + Math.floor(regCount / 15))).padStart(2, '0')}-${String((regCount % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      });
    }
  });

  // Marks for approved registrations
  const marks: Mark[] = [];
  const approvedRegs = registrations.filter(r => r.status === 'APPROVED');
  approvedRegs.forEach((reg, i) => {
    const exam = exams.find(e => e.id === reg.examId);
    if (!exam) return;
    exam.subjects.forEach(sub => {
      marks.push({
        id: `m${marks.length + 1}`,
        studentId: reg.studentId,
        registrationId: reg.id,
        examId: reg.examId,
        subjectId: sub.id,
        subjectName: sub.name,
        marks: Math.floor(Math.random() * (sub.fullMarks - sub.passMarks) + sub.passMarks * 0.6),
        enteredBy: 'u1',
        createdAt: '2025-12-20T00:00:00Z',
        updatedAt: '2025-12-20T00:00:00Z',
      });
    });
  });

  // Results for published exam
  const results: Result[] = [];
  const exam1Regs = registrations.filter(r => r.examId === 'e1' && r.status === 'APPROVED');
  exam1Regs.forEach((reg, i) => {
    const studentMarks = marks.filter(m => m.registrationId === reg.id);
    const totalFullMarks = studentMarks.reduce((sum, m) => {
      const exam = exams.find(e => e.id === m.examId);
      const sub = exam?.subjects.find(s => s.id === m.subjectId);
      return sum + (sub?.fullMarks || 100);
    }, 0);
    const totalMarks = studentMarks.reduce((sum, m) => sum + m.marks, 0);
    const percentage = totalFullMarks > 0 ? (totalMarks / totalFullMarks) * 100 : 0;
    const grades = ['A+', 'A', 'A-', 'B', 'C', 'D'];
    const gradeIdx = Math.min(5, Math.floor((100 - percentage) / 16));
    const grade = percentage >= 33 ? grades[gradeIdx] : 'F';

    results.push({
      id: `res${i + 1}`,
      studentId: reg.studentId,
      studentName: reg.studentName,
      institutionId: reg.institutionId,
      institutionName: reg.institutionName,
      examId: 'e1',
      examName: 'National Talent Scholarship Examination 2026',
      className: reg.className,
      roll: String(i + 1),
      registrationNumber: reg.applicationId,
      subjectMarks: studentMarks.map(m => ({ subjectId: m.subjectId, subjectName: m.subjectName, marks: m.marks, fullMarks: 100 })),
      totalMarks,
      totalFullMarks,
      percentage,
      grade,
      position: i + 1,
      pass: percentage >= 33,
      scholarshipStatus: percentage >= 75 ? 'ELIGIBLE' : percentage >= 60 ? 'PENDING' : 'NOT_ELIGIBLE',
      status: 'PUBLISHED',
      createdAt: '2025-12-25T00:00:00Z',
      updatedAt: '2025-12-25T00:00:00Z',
    });
  });

  // Certificates
  const certificates: Certificate[] = [];
  results.filter(r => r.scholarshipStatus === 'ELIGIBLE').forEach((res, i) => {
    certificates.push({
      id: `cert${i + 1}`,
      certificateNumber: `SCX-2026-${String(i + 1).padStart(6, '0')}`,
      studentId: res.studentId,
      studentName: res.studentName,
      institutionId: res.institutionId,
      institutionName: res.institutionName,
      examId: res.examId,
      examName: res.examName,
      className: res.className,
      position: res.position,
      totalMarks: res.totalMarks,
      examYear: '2026',
      issueDate: '2026-01-30T00:00:00Z',
      qrCode: `SCX-CERT-${i + 1}`,
      status: 'GENERATED',
      createdAt: '2026-01-30T00:00:00Z',
      updatedAt: '2026-01-30T00:00:00Z',
    });
  });

  // Payments
  const payments: Payment[] = [];
  ['i1', 'i2', 'i3'].forEach((instId, i) => {
    const inst = institutions.find(ins => ins.id === instId);
    const instRegs = registrations.filter(r => r.institutionId === instId && r.paymentStatus === 'PAID');
    if (instRegs.length > 0) {
      payments.push({
        id: `p${i + 1}`,
        transactionId: `TXN-${Date.now().toString(36).toUpperCase()}${i}`,
        institutionId: instId,
        institutionName: inst?.name || '',
        examId: 'e1',
        examName: 'National Talent Scholarship Examination 2026',
        studentCount: instRegs.length,
        amount: instRegs.length * 150,
        paymentMethod: 'Bkash',
        status: 'PAID',
        date: '2025-11-20T00:00:00Z',
        createdAt: '2025-11-20T00:00:00Z',
        updatedAt: '2025-11-20T00:00:00Z',
      });
    }
  });

  // Exam Centers
  const centers: ExamCenter[] = [
    { id: 'ec1', name: 'Dhaka Central Exam Center', address: '123 Motijheel, Dhaka', capacity: 500, allocated: 320, createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-09-01T00:00:00Z' },
    { id: 'ec2', name: 'Mirpur Exam Hall', address: '45 Mirpur-10, Dhaka', capacity: 300, allocated: 180, createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-09-01T00:00:00Z' },
    { id: 'ec3', name: 'Barisal Government College', address: '78 Sadar Road, Barisal', capacity: 200, allocated: 120, createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-09-01T00:00:00Z' },
    { id: 'ec4', name: 'Chittagong City Corporation Center', address: '90 Agrabad, Chittagong', capacity: 400, allocated: 250, createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-09-01T00:00:00Z' },
    { id: 'ec5', name: 'Rajshahi Cadet College Hall', address: '34 Kazla, Rajshahi', capacity: 250, allocated: 150, createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-09-01T00:00:00Z' },
  ];

  // Admit Cards
  const admitCards: AdmitCard[] = approvedRegs.slice(0, 30).map((reg, i) => ({
    id: `ac${i + 1}`,
    registrationId: reg.id,
    studentId: reg.studentId,
    studentName: reg.studentName,
    institutionName: reg.institutionName,
    examName: reg.examName,
    className: reg.className,
    roll: String(i + 1),
    registrationNumber: reg.applicationId,
    examDate: '2026-01-20T09:00:00Z',
    examCenter: centers[i % centers.length].name,
    qrCode: `QR-${reg.applicationId}`,
    instructions: 'Bring this admit card and a valid photo ID to the exam center. Arrive 30 minutes before the exam starts.',
    createdAt: '2025-12-15T00:00:00Z',
    updatedAt: '2025-12-15T00:00:00Z',
  }));

  // Notifications
  const notifications: Notification[] = [
    { id: 'n1', userId: 'u1', title: 'New Institution Registration', message: 'Sylhet Public School has submitted a registration request.', type: 'info', read: false, createdAt: '2025-03-01T10:00:00Z' },
    { id: 'n2', userId: 'u1', title: 'Institution Approved', message: 'Dhaka International Academy has been approved.', type: 'success', read: true, createdAt: '2025-01-12T08:00:00Z' },
    { id: 'n3', userId: 'u1', title: 'Exam Results Published', message: 'NTSE-2026 results have been published successfully.', type: 'success', read: true, createdAt: '2025-12-25T14:00:00Z' },
    { id: 'n4', userId: 'u1', title: 'Batch Certificates Generated', message: '45 certificates have been generated for NTSE-2026.', type: 'success', read: false, createdAt: '2026-01-30T09:00:00Z' },
    { id: 'n5', userId: 'u2', title: 'Registration Approved', message: '25 student registrations have been approved for NTSE-2026.', type: 'success', read: true, createdAt: '2025-11-20T11:00:00Z' },
    { id: 'n6', userId: 'u2', title: 'Payment Confirmed', message: 'Payment of ৳3,750 confirmed for NTSE-2026 registrations.', type: 'success', read: true, createdAt: '2025-11-21T09:00:00Z' },
    { id: 'n7', userId: 'u2', title: 'New Exam Available', message: 'District Merit Scholarship 2026 registration is now open.', type: 'info', read: false, createdAt: '2025-10-20T08:00:00Z' },
    { id: 'n8', userId: 'u1', title: 'Platform Update', message: 'System maintenance scheduled for this weekend.', type: 'warning', read: false, createdAt: '2025-12-20T10:00:00Z' },
  ];

  // Audit Logs
  const auditLogs: AuditLog[] = [
    { id: 'al1', userId: 'u1', userName: 'Super Admin', action: 'APPROVED', entity: 'Institution', entityId: 'i1', details: 'Approved Dhaka International Academy', createdAt: '2025-01-12T08:00:00Z' },
    { id: 'al2', userId: 'u1', userName: 'Super Admin', action: 'APPROVED', entity: 'Institution', entityId: 'i2', details: 'Approved Dhaka Model School', createdAt: '2025-01-16T08:00:00Z' },
    { id: 'al3', userId: 'u1', userName: 'Super Admin', action: 'PUBLISHED', entity: 'Exam Results', entityId: 'e1', details: 'Published NTSE-2026 results', createdAt: '2025-12-25T14:00:00Z' },
    { id: 'al4', userId: 'u1', userName: 'Super Admin', action: 'GENERATED', entity: 'Certificates', entityId: 'e1', details: 'Generated 45 certificates for NTSE-2026', createdAt: '2026-01-30T09:00:00Z' },
    { id: 'al5', userId: 'u2', userName: 'Rahim Ahmed', action: 'REGISTERED', entity: 'Students', entityId: 'i1', details: 'Registered 25 students for NTSE-2026', createdAt: '2025-11-15T10:00:00Z' },
    { id: 'al6', userId: 'u2', userName: 'Rahim Ahmed', action: 'SUBMITTED', entity: 'Payment', entityId: 'p1', details: 'Submitted payment for NTSE-2026 registrations', createdAt: '2025-11-20T11:00:00Z' },
    { id: 'al7', userId: 'u1', userName: 'Super Admin', action: 'SUSPENDED', entity: 'Institution', entityId: 'i9', details: 'Suspended Comilla Baptist School for review', createdAt: '2025-03-15T12:00:00Z' },
  ];

  // Save all data
  setStore(USER_KEY, users);
  setStore(INST_KEY, institutions);
  setStore(STUD_KEY, students);
  setStore(EXAM_KEY, exams);
  setStore(REG_KEY, registrations);
  setStore(MARK_KEY, marks);
  setStore(RES_KEY, results);
  setStore(CERT_KEY, certificates);
  setStore(PAY_KEY, payments);
  setStore(NOTIF_KEY, notifications);
  setStore(AUDIT_KEY, auditLogs);
  setStore(CENTER_KEY, centers);
  setStore(ADMIT_KEY, admitCards);

  markInitialized();
}
