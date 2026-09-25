export type UserRole = 'SUPER_ADMIN' | 'INSTITUTION_ADMIN';
export type InstitutionStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type ExamStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'EXAM_COMPLETED' | 'RESULT_PROCESSING' | 'PUBLISHED' | 'ARCHIVED';
export type RegistrationStatus = 'PENDING' | 'VERIFIED' | 'PAYMENT_PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'FAILED' | 'REFUNDED';
export type ResultStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
export type CertificateStatus = 'DRAFT' | 'GENERATED' | 'VERIFIED';

export interface AcademicSession {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string;
  role: UserRole;
  institutionId?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  username?: string;
  institutionId?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Institution {
  id: string;
  name: string;
  /** English name from registration ("Name (English)") — empty for legacy rows. */
  nameEn?: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  contactPerson: string;
  contactPersonPhone: string;
  adminUserId?: string;
  status: InstitutionStatus;
  logo?: string;
  /** Principal's signature image URL — shown on the admit-card footer. */
  principalSignature?: string;
  totalStudents: number;
  totalApplications: number;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  institutionId: string;
  sessionId: string;
  firstName: string;
  lastName: string;
  firstNameBn?: string;
  lastNameBn?: string;
  studentId: string;
  class: string;
  section: string;
  roll: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  fatherName: string;
  motherName: string;
  phone: string;
  address: string;
  photo?: string;
  /** Class-wise exam roll (6 digits, e.g. 110001) — set by the super admin's Generate Roll. */
  examRoll?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  sessionId: string;
  name: string;
  code: string;
  academicYear: string;
  description: string;
  registrationStartDate: string;
  registrationEndDate: string;
  examDate: string;
  /** Exam window (routine is built inside these dates). examDate stays synced to examStartDate for legacy readers. */
  examStartDate?: string;
  examEndDate?: string;
  registrationFee: number;
  lateFee: number;
  classes: string[];
  subjects: ExamSubject[];
  /** Day-by-day schedule built on the Routine page — dates fall inside examStartDate..examEndDate. */
  routine?: ExamRoutineSlot[];
  status: ExamStatus;
  createdAt: string;
  updatedAt: string;
}

/** One scheduled slot of an exam routine: a class's subject on a day inside the exam window. */
export interface ExamRoutineSlot {
  id: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  /** YYYY-MM-DD, inside examStartDate..examEndDate */
  date: string;
  /** HH:MM */
  startTime?: string;
  /** HH:MM */
  endTime?: string;
}

export interface ExamSubject {
  id: string;
  /** Class this subject belongs to (classes.id) — subjects are stored per class on the exam. */
  classId?: string;
  name: string;
  fullMarks: number;
  passMarks: number;
  duration: number;
  negativeMarks: number;
}

export interface MarkGradeBand {
  id: string;
  grade: string;
  points: number;
  minPercent: number;
  maxPercent: number;
}

export interface ScholarshipCategoryRange {
  id: string;
  name: string;
  minPercent: number;
  maxPercent: number;
}

export interface ExamMarkSetup {
  examId: string;
  subjects: ExamSubject[];
  gradeBands: MarkGradeBand[];
  scholarshipCategories: ScholarshipCategoryRange[];
  passPercent: number;
  version: number;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt: string;
}

export interface ExamMarkSetupInput {
  examId: string;
  subjects: ExamSubject[];
  gradeBands: MarkGradeBand[];
  scholarshipCategories: ScholarshipCategoryRange[];
  passPercent: number;
}

export interface ExamMarkSetupSaveResult {
  version: number;
  updatedAt: string;
  setup: ExamMarkSetup;
}

export interface Registration {
  id: string;
  sessionId: string;
  applicationId: string;
  registrationNumber: string;
  studentId: string;
  studentName: string;
  institutionId: string;
  institutionName: string;
  examId: string;
  examName: string;
  className: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  studentPaymentStatus: StudentPaymentStatus;
  paymentAmount: number;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamCenter {
  id: string;
  sessionId: string;
  name: string;
  address: string;
  capacity: number;
  allocated: number;
  institutionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdmitCard {
  id: string;
  sessionId: string;
  registrationId: string;
  studentId: string;
  studentName: string;
  institutionName: string;
  examName: string;
  className: string;
  roll: string;
  registrationNumber: string;
  examDate: string;
  examCenter: string;
  qrCode: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mark {
  id: string;
  sessionId: string;
  studentId: string;
  registrationId: string;
  examId: string;
  subjectId: string;
  subjectName: string;
  marks: number;
  enteredBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarksSheetPageRow {
  registrationId: string;
  studentId: string;
  studentName: string;
  institutionId: string;
  institutionName: string;
  registrationNumber: string;
  className: string;
  examRoll: string | null;
  mark: number | null;
  fullMarks: number;
  subjectName: string;
}

export interface MarksSheetPage {
  rows: MarksSheetPageRow[];
  page: number;
  pageSize: number;
  totalMatching: number;
  totalPages: number;
  totalCandidates: number;
  summary: {
    totalCandidates: number;
    institutionsRepresented: number;
    enteredCount: number;
    missingCount: number;
  };
}

export interface MarksSaveRejection {
  registrationId: string | null;
  subjectId: string | null;
  reason: string;
}

export interface MarksSaveResult {
  saved: number;
  updated: number;
  savedRows: { registrationId: string; subjectId: string; marks: number }[];
  updatedRows: { registrationId: string; subjectId: string; marks: number }[];
  rejected: MarksSaveRejection[];
}

export interface Result {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  institutionId: string;
  institutionName: string;
  examId: string;
  examName: string;
  className: string;
  roll: string;
  registrationNumber: string;
  subjectMarks: { subjectId: string; subjectName: string; marks: number; fullMarks: number }[];
  totalMarks: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
  position: number;
  pass: boolean;
  scholarshipStatus: string;
  status: ResultStatus;
  markSetupVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  id: string;
  sessionId: string;
  certificateNumber: string;
  studentId: string;
  studentName: string;
  institutionId: string;
  institutionName: string;
  examId: string;
  examName: string;
  className: string;
  position: number;
  totalMarks: number;
  examYear: string;
  issueDate: string;
  resultId?: string;
  qrCode: string;
  status: CertificateStatus;
  createdAt: string;
  updatedAt: string;
}

export type StudentPaymentStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
export type StudentPaymentMethod = 'BKASH' | 'ROCKET' | 'BANK_TRANSFER' | 'CASH';

export interface Payment {
  id: string;
  sessionId: string;
  transactionId: string;
  institutionId: string;
  institutionName: string;
  examId?: string;
  examName?: string;
  studentCount: number;
  amount: number;
  paymentMethod: string;
  status: PaymentStatus;
  date: string;
  registrationId?: string;
  studentId?: string;
  studentName?: string;
  reference?: string;
  paymentDate?: string;
  notes?: string;
  submittedByStudent?: boolean;
  submittedAt?: string;
  receiptNumber?: string;
  accountNumber?: string;
  proofImage?: string;
  verifiedBySuperAdmin?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  /** Optional route opened when the notification is clicked */
  link?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
}

export interface GradeBand { min: number; grade: string }

export interface GradingScale {
  bands: GradeBand[];
  passPercent: number;
  talentpoolPercent: number;
  generalScholarshipMin: number;
  generalScholarshipMax: number;
}