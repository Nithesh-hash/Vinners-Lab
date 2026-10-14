export interface Component {
  id: string;
  name: string;
  category: string;
  description: string;
  totalQuantity: number;
  availableQuantity: number;
  issuedQuantity: number;
  damagedQuantity?: number;
  lowStockThreshold: number;
  storageLocation?: string;
  imageUrl?: string;
  createdAt: any; // Firestore timestamp
  updatedAt: any;
  isArchived: boolean;
}

export interface ReturnLogEntry {
  returnDate: any;
  returnedQuantity: number;
  condition: 'Good' | 'Damaged' | 'Incomplete';
  adminNotes?: string;
  adminId: string;
  adminName?: string;
  adminEmail?: string;
}

export interface Transaction {
  id: string;
  componentId: string;
  componentName: string;
  studentId: string;
  studentName: string;
  studentRegNumber: string;
  studentEmail?: string;
  quantity: number;
  returnedQuantity?: number; // Accumulated returned units
  expectedReturnDate: any; // Firestore timestamp
  issueDate: any; // Firestore timestamp
  returnDate?: any; // Firestore timestamp
  issuedByAdminId: string;
  issuedByAdminName?: string;
  returnedByAdminId?: string;
  returnedByAdminName?: string;
  condition?: 'Good' | 'Damaged' | 'Incomplete';
  adminNotes?: string;
  returnsLog?: ReturnLogEntry[];
  status: 'Checked Out' | 'Partially Returned' | 'Returned' | 'Overdue';
  projectPurpose?: string;
  studentCode?: string; // e.g. "IIC2026-27-0001"
  // Project Code Linkage
  projectCode?: string; // e.g. "SSV2026-27-0001"
  facultyEmployeeId?: string;
  facultyName?: string;
  facultyMobile?: string;
  teamStudentRegNumbers?: string[]; // All students in the team
  teamStudents?: ProjectMember[];
  collectedByStudentName?: string;
  collectedByStudentRegNumber?: string;
}

export interface ProjectFaculty {
  name: string;
  employeeId: string;
  mobileNumber: string;
  email?: string;
  uid?: string;
}

export interface ProjectMember {
  name: string;
  regNumber: string;
  studentCode?: string; // e.g. "IIC2026-27-0001"
  mobileNumber?: string;
  email?: string;
  uid?: string;
}

export interface ProjectIssuedItem {
  transactionId: string;
  componentId: string;
  componentName: string;
  quantity: number;
  returnedQuantity?: number;
  collectedByStudentName: string;
  collectedByStudentRegNumber: string;
  issueDate: any;
  expectedReturnDate: any;
  status: 'Checked Out' | 'Partially Returned' | 'Returned' | 'Overdue';
}

export interface ProjectCode {
  id: string;
  code: string; // e.g. "SSV2026-27-0001" or "FSV2026-27-0001"
  codeType: 'SSV' | 'FSV';
  academicYear: string; // e.g. "2026-27"
  faculty: ProjectFaculty;
  students: ProjectMember[];
  studentRegNumbers: string[]; // Uppercase array for querying
  facultyEmployeeId: string; // Uppercase for querying
  createdAt: any;
  createdByAdminId: string;
  createdByName?: string;
  issuedItems?: ProjectIssuedItem[];
  status: 'Active' | 'Completed' | 'Archived';
}

export interface NotificationItem {
  id: string;
  userId?: string;
  targetRegNumber?: string; // studentRegNumber or facultyEmployeeId
  roleTarget?: 'student' | 'faculty' | 'all';
  title: string;
  message: string;
  type: 'code_generated' | 'component_issued' | 'due_date_warning' | 'overdue_alert';
  projectCode?: string;
  componentName?: string;
  dueDate?: any;
  isRead: boolean;
  createdAt: any;
  urgency?: 'info' | 'warning' | 'danger';
}

