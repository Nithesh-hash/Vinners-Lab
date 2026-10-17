export interface Component {
  id: string;
  code?: string; // Laboratory component code, e.g. "IIC-C1" where C is component
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
  componentCode?: string; // e.g. "IIC-C1"
  componentName: string;
  studentId: string;
  studentName: string;
  studentRegNumber: string;
  studentEmail?: string;
  studentMobile?: string;
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
  faculty2?: ProjectFaculty;
  faculties?: ProjectFaculty[];
  students: ProjectMember[];
  studentRegNumbers: string[]; // Uppercase array for querying
  facultyEmployeeId: string; // Uppercase for querying (Faculty 1)
  facultyEmployeeIds?: string[]; // Uppercase array for querying (Faculty 1 and Faculty 2)
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
  roleTarget?: 'student' | 'faculty' | 'admin' | 'all';
  title: string;
  message: string;
  type: 
    | 'code_generated' 
    | 'component_issued' 
    | 'due_date_warning' 
    | 'overdue_alert'
    | 'issue_request_submitted'
    | 'issue_request_approved'
    | 'issue_request_partially_issued'
    | 'issue_request_completed'
    | 'issue_request_rejected';
  projectCode?: string;
  componentName?: string;
  requestId?: string;
  dueDate?: any;
  isRead: boolean;
  createdAt: any;
  urgency?: 'info' | 'warning' | 'danger';
}

export interface IssueRequestItem {
  componentId: string;
  componentCode?: string;
  componentName: string;
  category?: string;
  imageUrl?: string;
  requestedQuantity: number;
  approvedQuantity?: number; // Editable by admin (e.g. reduced count)
  issuedQuantity?: number;   // Cumulative units handed over at counter
  unitsIssuedSoFar?: number; // Cumulative units handed over at counter (alias)
  status?: 'pending' | 'approved' | 'issued' | 'declined';
  notes?: string;
}

export interface IssueRequestLog {
  timestamp: any;
  action: 'submitted' | 'approved' | 'partially_issued' | 'completed' | 'rejected' | 'updated';
  actorId: string;
  actorName: string;
  actorRole: 'student' | 'faculty' | 'admin';
  note?: string;
  itemsIssued?: Array<{
    componentId: string;
    componentName: string;
    quantity: number;
  }>;
}

export interface IssueRequest {
  id: string;
  requestCode: string; // e.g. "REQ-2026-0001"
  requesterUid: string;
  requesterName: string;
  requesterRegNumber: string; // Student Reg Number or Faculty Employee ID
  requesterEmail?: string;
  requesterMobile?: string;
  requesterRole: 'student' | 'faculty';
  studentCode?: string; // e.g. "IIC2026-27-0001"
  
  // SSV / FSV Project linkage (optional)
  projectCode?: string; // e.g. "SSV2026-27-0001" or "FSV2026-27-0001"
  recipientType?: 'student' | 'faculty';
  recipientName?: string;
  recipientRegNumber?: string;
  
  items: IssueRequestItem[];
  purposeNotes?: string;
  
  status: 'pending' | 'approved' | 'partially_issued' | 'completed' | 'rejected';
  
  adminNotes?: string;
  rejectionReason?: string;
  
  createdAt: any; // Firestore timestamp
  updatedAt?: any;
  approvedAt?: any;
  approvedByAdminId?: string;
  approvedByAdminName?: string;
  
  // Detailed audit trail of handovers and actions
  logs?: IssueRequestLog[];
}


