export interface Component {
  id: string;
  name: string;
  category: string;
  description: string;
  totalQuantity: number;
  availableQuantity: number;
  issuedQuantity: number;
  lowStockThreshold: number;
  storageLocation?: string;
  imageUrl?: string;
  createdAt: any; // Firestore timestamp
  updatedAt: any;
  isArchived: boolean;
}

export interface Transaction {
  id: string;
  componentId: string;
  componentName: string;
  studentId: string;
  studentName: string;
  studentRegNumber: string;
  quantity: number;
  expectedReturnDate: any; // Firestore timestamp
  issueDate: any; // Firestore timestamp
  returnDate?: any; // Firestore timestamp
  issuedByAdminId: string;
  returnedByAdminId?: string;
  status: 'Checked Out' | 'Partially Returned' | 'Returned' | 'Overdue';
  projectPurpose?: string;
}
