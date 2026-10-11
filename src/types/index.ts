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
  returnedByAdminId?: string;
  returnedByAdminName?: string;
  condition?: 'Good' | 'Damaged' | 'Incomplete';
  adminNotes?: string;
  returnsLog?: ReturnLogEntry[];
  status: 'Checked Out' | 'Partially Returned' | 'Returned' | 'Overdue';
  projectPurpose?: string;
}
