import { User, Institution, Student, Exam, Registration, Result, Certificate, Payment, Notification, AuditLog, ExamCenter, AdmitCard, Mark, Class } from '../types';
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
const CLASS_KEY = 'classes';
const INIT_KEY = 'initialized_v2';

export function isInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('scholarx_' + INIT_KEY) === 'true';
}

export function markInitialized(): void {
  localStorage.setItem('scholarx_' + INIT_KEY, 'true');
}

export function initializeDemoData(): void {
  if (isInitialized()) {
    try {
      const users = JSON.parse(localStorage.getItem('scholarx_users') || '[]');
      if (users.length > 0 && users[0].password) return;
    } catch { /* ignore */ }
    localStorage.removeItem('scholarx_initialized');
  }

  const users: User[] = [
    { id: 'u1', email: 'admin@scholarx.local', name: 'Super Admin', password: 'admin123', role: 'SUPER_ADMIN', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  ];

  const institutions: Institution[] = [];

  const students: Student[] = [];

  const classesData: Class[] = [];

  const exams: Exam[] = [
    {
      id: 'e1', name: 'National Talent Scholarship Examination 2026', code: 'NTSE-2026',
      academicYear: '2026', description: 'National level scholarship examination for talented students across Bangladesh.',
      registrationStartDate: '2025-10-01T00:00:00Z', registrationEndDate: '2025-12-15T00:00:00Z',
      examDate: '2026-01-20T00:00:00Z', registrationFee: 150, lateFee: 50,
      classes: ['cls1', 'cls2', 'cls3', 'cls4'],
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
      classes: ['cls3', 'cls4', 'cls5'],
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
      classes: ['cls1', 'cls2', 'cls3'],
      subjects: [
        { id: 'sub8', name: 'Mathematics', fullMarks: 50, passMarks: 17, duration: 60, negativeMarks: 0 },
        { id: 'sub9', name: 'Bangla', fullMarks: 50, passMarks: 17, duration: 60, negativeMarks: 0 },
      ],
      status: 'OPEN', createdAt: '2025-11-25T00:00:00Z', updatedAt: '2025-11-25T00:00:00Z',
    },
  ];

  const registrations: Registration[] = [];
  const marks: Mark[] = [];
  const results: Result[] = [];
  const certificates: Certificate[] = [];
  const payments: Payment[] = [];
  const centers: ExamCenter[] = [];
  const admitCards: AdmitCard[] = [];
  const notifications: Notification[] = [];
  const auditLogs: AuditLog[] = [];

  setStore(USER_KEY, users);
  setStore(INST_KEY, institutions);
  setStore(STUD_KEY, students);
  setStore(CLASS_KEY, classesData);
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
