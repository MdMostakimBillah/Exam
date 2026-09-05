export type UserRole = 'SUPER_ADMIN' | 'INSTITUTION_ADMIN';
export type InstitutionStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type ExamStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'EXAM_COMPLETED' | 'RESULT_PROCESSING' | 'PUBLISHED' | 'ARCHIVED';
export type RegistrationStatus = 'PENDING' | 'VERIFIED' | 'PAYMENT_PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';
export type ResultStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
export type CertificateStatus = 'DRAFT' | 'GENERATED' | 'VERIFIED';

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
  password: string;
  role: UserRole;
  institutionId?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Institution {
  id: string;
  name: string;
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
  totalStudents: number;
  totalApplications: number;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  institutionId: string;
  firstName: string;
  lastName: string;
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
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  name: string;
  code: string;
  academicYear: string;
  description: string;
  registrationStartDate: string;
  registrationEndDate: string;
  examDate: string;
  registrationFee: number;
  lateFee: number;
  classes: string[];
  subjects: ExamSubject[];
  status: ExamStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExamSubject {
  id: string;
  name: string;
  fullMarks: number;
  passMarks: number;
  duration: number;
  negativeMarks: number;
}

export interface Registration {
  id: string;
  applicationId: string;
  studentId: string;
  studentName: string;
  institutionId: string;
  institutionName: string;
  examId: string;
  examName: string;
  className: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  paymentAmount: number;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamCenter {
  id: string;
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

export interface Result {
  id: string;
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
  scholarshipStatus: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'PENDING';
  status: ResultStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  id: string;
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
  qrCode: string;
  status: CertificateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  institutionId: string;
  institutionName: string;
  examId: string;
  examName: string;
  studentCount: number;
  amount: number;
  paymentMethod: string;
  status: PaymentStatus;
  date: string;
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
