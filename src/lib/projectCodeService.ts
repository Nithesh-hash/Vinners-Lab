import { collection, query, where, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { ProjectCode, ProjectMember, ProjectFaculty, Component, NotificationItem } from '@/types';

/**
 * Returns current academic year format, e.g. "2026-27"
 */
export function getAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 is January, 5 is June
  const startYear = month >= 5 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
}

/**
 * Computes next sequential project code based on chosen prefix (SSV or FSV) and academic year.
 * e.g. "SSV2026-27-0001" or "FSV2026-27-0001"
 * The last 4 digits change and increment sequentially every time a new code is created.
 */
export async function getNextProjectCode(codeType: 'SSV' | 'FSV' = 'SSV'): Promise<string> {
  const acadYear = getAcademicYear();
  const prefix = `${codeType}${acadYear}-`;

  try {
    const q = query(
      collection(db, 'project_codes'),
      where('academicYear', '==', acadYear)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return `${prefix}0001`;
    }

    let maxNum = 0;
    snap.docs.forEach(d => {
      const c = d.data().code as string;
      if (c && c.startsWith(prefix)) {
        const parts = c.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  } catch (error) {
    console.warn("Could not query codes for sequence:", error);
    return `${prefix}0001`;
  }
}

export interface VerifiedUserResult {
  exists: boolean;
  user?: {
    uid: string;
    name: string;
    email: string;
    regNumber: string;
    mobileNumber?: string;
    role: string;
  };
  error?: string;
}

/**
 * Verify whether a registration number or employee ID is registered in the portal
 */
export async function verifyUserInPortal(identifier: string): Promise<VerifiedUserResult> {
  const cleanId = identifier.trim().toUpperCase();
  if (!cleanId) {
    return { exists: false, error: 'Identifier is required' };
  }

  try {
    // 1. Check by regNumber (used for both student regNumber and faculty employee ID)
    const qReg = query(collection(db, 'users'), where('regNumber', '==', cleanId));
    const snapReg = await getDocs(qReg);

    if (!snapReg.empty) {
      const data = snapReg.docs[0].data();
      return {
        exists: true,
        user: {
          uid: snapReg.docs[0].id,
          name: data.name || '',
          email: data.email || '',
          regNumber: data.regNumber || cleanId,
          mobileNumber: data.mobileNumber || '',
          role: data.role || 'student'
        }
      };
    }

    // 2. Fallback check by email (in case entered email)
    if (cleanId.includes('@')) {
      const qEmail = query(collection(db, 'users'), where('email', '==', cleanId.toLowerCase()));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const data = snapEmail.docs[0].data();
        return {
          exists: true,
          user: {
            uid: snapEmail.docs[0].id,
            name: data.name || '',
            email: data.email || '',
            regNumber: data.regNumber || cleanId,
            mobileNumber: data.mobileNumber || '',
            role: data.role || 'student'
          }
        };
      }
    }

    return { exists: false, error: 'User is not registered in the portal' };
  } catch (error: any) {
    console.error("Error verifying user:", error);
    return { exists: false, error: error.message || 'Verification lookup failed' };
  }
}

/**
 * Deeply strips undefined fields from an object or array.
 * Firestore WriteBatch throws an error if any field in an object or array is undefined.
 */
export function cleanForFirestore<T>(input: T): T {
  if (input === null || input === undefined) {
    return null as any;
  }
  // Preserve Date and Firestore Timestamp instances
  if (input instanceof Date || (input && typeof input === 'object' && 'toDate' in input)) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(item => cleanForFirestore(item)) as any;
  }
  if (typeof input === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as any;
  }
  return input;
}

/**
 * Creates a project code document and initial notifications
 */
export async function createProjectCodeRecord(params: {
  code: string;
  codeType?: 'SSV' | 'FSV';
  faculty: ProjectFaculty;
  students: ProjectMember[];
  adminId: string;
  adminName: string;
}): Promise<ProjectCode> {
  const { code, faculty, students, adminId, adminName } = params;
  const codeType: 'SSV' | 'FSV' = params.codeType || (code.startsWith('FSV') ? 'FSV' : 'SSV');
  const acadYear = getAcademicYear();
  const batch = writeBatch(db);

  const codeRef = doc(db, 'project_codes', code);
  const studentRegNumbers = students.map(s => s.regNumber.toUpperCase());
  const facultyEmployeeId = faculty.employeeId.toUpperCase();

  const sanitizedFaculty: ProjectFaculty = {
    name: faculty.name.trim(),
    employeeId: facultyEmployeeId,
    mobileNumber: faculty.mobileNumber.trim()
  };
  if (faculty.email) sanitizedFaculty.email = faculty.email.trim();
  if (faculty.uid) sanitizedFaculty.uid = faculty.uid.trim();

  const sanitizedStudents: ProjectMember[] = students.map(s => {
    const item: ProjectMember = {
      name: s.name.trim(),
      regNumber: s.regNumber.trim().toUpperCase()
    };
    if (s.mobileNumber && s.mobileNumber.trim()) {
      item.mobileNumber = s.mobileNumber.trim();
    }
    if (s.email && s.email.trim()) {
      item.email = s.email.trim();
    }
    if (s.uid && s.uid.trim()) {
      item.uid = s.uid.trim();
    }
    return item;
  });

  const projectCodeData: ProjectCode = {
    id: code,
    code,
    codeType,
    academicYear: acadYear,
    faculty: sanitizedFaculty,
    students: sanitizedStudents,
    studentRegNumbers,
    facultyEmployeeId,
    createdAt: Timestamp.now(),
    createdByAdminId: adminId,
    createdByName: adminName,
    issuedItems: [],
    status: 'Active'
  };

  // Set project code with strictly cleaned data
  batch.set(codeRef, cleanForFirestore(projectCodeData));

  // Automatically dispatch notification to all team students
  sanitizedStudents.forEach(student => {
    const notifRef = doc(collection(db, 'notifications'));
    const notif: NotificationItem = {
      id: notifRef.id,
      targetRegNumber: student.regNumber.toUpperCase(),
      roleTarget: 'student',
      title: `Project Code Assigned: ${code}`,
      message: `You have been added to Project Code ${code} guided by Faculty ${sanitizedFaculty.name}. You can now collect authorized hardware components from Vinner Lab.`,
      type: 'code_generated',
      projectCode: code,
      isRead: false,
      createdAt: Timestamp.now(),
      urgency: 'info'
    };
    if (student.uid) {
      notif.userId = student.uid;
    }
    batch.set(notifRef, cleanForFirestore(notif));
  });

  // Automatically dispatch notification to faculty guide
  const facultyNotifRef = doc(collection(db, 'notifications'));
  const facultyNotif: NotificationItem = {
    id: facultyNotifRef.id,
    targetRegNumber: facultyEmployeeId,
    roleTarget: 'faculty',
    title: `Project Code Registered: ${code}`,
    message: `Project Code ${code} has been registered with ${sanitizedStudents.length} students under your guidance (${sanitizedFaculty.name}). Component checkouts will be tracked under this code.`,
    type: 'code_generated',
    projectCode: code,
    isRead: false,
    createdAt: Timestamp.now(),
    urgency: 'info'
  };
  if (sanitizedFaculty.uid) {
    facultyNotif.userId = sanitizedFaculty.uid;
  }
  batch.set(facultyNotifRef, cleanForFirestore(facultyNotif));

  await batch.commit();
  return projectCodeData;
}

/**
 * Deletes a project code record and its associated notifications from Firestore
 */
export async function deleteProjectCodeRecord(code: string): Promise<void> {
  const batch = writeBatch(db);
  const codeRef = doc(db, 'project_codes', code);
  batch.delete(codeRef);

  // Clean up notifications generated for this project code
  try {
    const notifQ = query(collection(db, 'notifications'), where('projectCode', '==', code));
    const notifSnap = await getDocs(notifQ);
    notifSnap.forEach(nDoc => {
      batch.delete(doc(db, 'notifications', nDoc.id));
    });
  } catch (e) {
    console.warn("Could not batch delete notifications for code:", code, e);
  }

  await batch.commit();
}

/**
 * Calculates due date status: overdue, days remaining, nearing warning
 */
export function getDueDateStatus(dueDate: any): {
  isOverdue: boolean;
  isNearing: boolean;
  daysRemaining: number;
  formattedDate: string;
} {
  if (!dueDate) {
    return { isOverdue: false, isNearing: false, daysRemaining: 0, formattedDate: 'N/A' };
  }

  const targetDate: Date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate.seconds ? dueDate.seconds * 1000 : dueDate);
  const now = new Date();
  
  const diffTime = targetDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0;
  // Nearing if 7 days or fewer remaining (and not already past)
  const isNearing = daysRemaining >= 0 && daysRemaining <= 7;

  return {
    isOverdue,
    isNearing,
    daysRemaining,
    formattedDate: targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  };
}

/**
 * Issues a hardware component under a specific Project Code to a selected student
 */
export async function issueComponentUnderProjectCode(params: {
  projectCode: ProjectCode;
  selectedStudent: ProjectMember;
  component: Component;
  quantity: number;
  dueDate: Date;
  adminId: string;
  adminName: string;
  notes?: string;
}): Promise<string> {
  const { projectCode, selectedStudent, component, quantity, dueDate, adminId, adminName, notes } = params;

  if (component.availableQuantity < quantity) {
    throw new Error(`Insufficient stock. Only ${component.availableQuantity} unit(s) available.`);
  }

  const batch = writeBatch(db);
  const txRef = doc(collection(db, 'transactions'));
  const dueTimestamp = Timestamp.fromDate(dueDate);

  // 1. Create Transaction
  const transactionData = {
    id: txRef.id,
    componentId: component.id,
    componentName: component.name,
    studentId: selectedStudent.uid || '',
    studentName: selectedStudent.name,
    studentRegNumber: selectedStudent.regNumber.toUpperCase(),
    studentEmail: selectedStudent.email || '',
    quantity,
    returnedQuantity: 0,
    expectedReturnDate: dueTimestamp,
    issueDate: Timestamp.now(),
    status: 'Checked Out',
    issuedByAdminId: adminId,
    issuedByAdminName: adminName,
    adminNotes: notes || '',
    // Project Code Linkage
    projectCode: projectCode.code,
    facultyEmployeeId: projectCode.faculty.employeeId.toUpperCase(),
    facultyName: projectCode.faculty.name,
    facultyMobile: projectCode.faculty.mobileNumber,
    teamStudentRegNumbers: projectCode.studentRegNumbers,
    teamStudents: projectCode.students,
    collectedByStudentName: selectedStudent.name,
    collectedByStudentRegNumber: selectedStudent.regNumber.toUpperCase()
  };
  batch.set(txRef, cleanForFirestore(transactionData));

  // 2. Update Inventory Quantities
  const compRef = doc(db, 'inventory', component.id);
  batch.update(compRef, cleanForFirestore({
    availableQuantity: component.availableQuantity - quantity,
    issuedQuantity: component.issuedQuantity + quantity,
    updatedAt: Timestamp.now()
  }));

  // 3. Update Project Code record with issued item
  const codeRef = doc(db, 'project_codes', projectCode.code);
  const newIssuedItem = {
    transactionId: txRef.id,
    componentId: component.id,
    componentName: component.name,
    quantity,
    returnedQuantity: 0,
    collectedByStudentName: selectedStudent.name,
    collectedByStudentRegNumber: selectedStudent.regNumber.toUpperCase(),
    issueDate: Timestamp.now(),
    expectedReturnDate: dueTimestamp,
    status: 'Checked Out' as const
  };

  const updatedIssuedItems = [...(projectCode.issuedItems || []), newIssuedItem];
  batch.update(codeRef, cleanForFirestore({
    issuedItems: updatedIssuedItems
  }));

  // 4. Send Notifications to ALL students and faculty in the team
  const formattedDueDate = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Notifications for all team students
  projectCode.students.forEach(student => {
    const notifRef = doc(collection(db, 'notifications'));
    const isCollector = student.regNumber.toUpperCase() === selectedStudent.regNumber.toUpperCase();
    const notif: NotificationItem = {
      id: notifRef.id,
      targetRegNumber: student.regNumber.toUpperCase(),
      roleTarget: 'student',
      title: `Hardware Issued: ${component.name}`,
      message: `${quantity}x ${component.name} issued to ${isCollector ? 'you' : selectedStudent.name} (${selectedStudent.regNumber}) under Code ${projectCode.code}. Due date: ${formattedDueDate}.`,
      type: 'component_issued',
      projectCode: projectCode.code,
      componentName: component.name,
      dueDate: dueTimestamp,
      isRead: false,
      createdAt: Timestamp.now(),
      urgency: 'info'
    };
    if (student.uid) {
      notif.userId = student.uid;
    }
    batch.set(notifRef, cleanForFirestore(notif));
  });

  // Notification for faculty
  const facultyNotifRef = doc(collection(db, 'notifications'));
  const facultyNotif: NotificationItem = {
    id: facultyNotifRef.id,
    targetRegNumber: projectCode.faculty.employeeId.toUpperCase(),
    roleTarget: 'faculty',
    title: `Component Issued for Code ${projectCode.code}`,
    message: `${quantity}x ${component.name} issued to student ${selectedStudent.name} under Project Code ${projectCode.code}. Due date: ${formattedDueDate}.`,
    type: 'component_issued',
    projectCode: projectCode.code,
    componentName: component.name,
    dueDate: dueTimestamp,
    isRead: false,
    createdAt: Timestamp.now(),
    urgency: 'info'
  };
  if (projectCode.faculty.uid) {
    facultyNotif.userId = projectCode.faculty.uid;
  }
  batch.set(facultyNotifRef, cleanForFirestore(facultyNotif));

  await batch.commit();
  return txRef.id;
}

/**
 * Automatically checks active checkouts for approaching due dates (<= 7 days) or overdue items,
 * and records notification alerts to Firestore automatically without duplicate spam.
 */
export async function checkAndAutoSendDueDateNotifications(): Promise<number> {
  if (!auth.currentUser) return 0;
  try {
    const q = query(collection(db, 'transactions'), where('status', '==', 'Checked Out'));
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const batch = writeBatch(db);
    let createdCount = 0;

    for (const docSnap of snap.docs) {
      const tx = docSnap.data() as any;
      if (!tx.expectedReturnDate) continue;

      const outstanding = (tx.quantity || 0) - (tx.returnedQuantity || 0);
      if (outstanding <= 0) continue;

      const status = getDueDateStatus(tx.expectedReturnDate);
      if (!status.isNearing && !status.isOverdue) continue;

      const urgency: 'danger' | 'warning' = status.isOverdue ? 'danger' : 'warning';
      const statusType: 'overdue_alert' | 'due_date_warning' = status.isOverdue ? 'overdue_alert' : 'due_date_warning';
      const studentReg = tx.studentRegNumber ? tx.studentRegNumber.toUpperCase() : '';

      if (!studentReg) continue;

      // Deterministic ID prevents duplicate notifications for the same status condition
      const notifId = `auto_due_${tx.id}_${statusType}_${studentReg}`;
      const notifRef = doc(db, 'notifications', notifId);

      const title = status.isOverdue
        ? `⚠️ OVERDUE: Return ${tx.componentName}`
        : `⏰ Return Due Soon: ${tx.componentName} (${status.daysRemaining} days remaining)`;

      const message = status.isOverdue
        ? `The loan of ${outstanding}x ${tx.componentName} issued under Project Code ${tx.projectCode || 'N/A'} was due on ${status.formattedDate}. Please return it to Vinner Lab immediately.`
        : `Reminder: ${outstanding}x ${tx.componentName} issued under Project Code ${tx.projectCode || 'N/A'} is due for return on ${status.formattedDate} (${status.daysRemaining} days left).`;

      const notifData: NotificationItem = {
        id: notifId,
        targetRegNumber: studentReg,
        roleTarget: 'student',
        title,
        message,
        type: statusType,
        projectCode: tx.projectCode || '',
        componentName: tx.componentName,
        dueDate: tx.expectedReturnDate,
        isRead: false,
        createdAt: Timestamp.now(),
        urgency
      };

      if (tx.studentId) {
        notifData.userId = tx.studentId;
      }

      batch.set(notifRef, cleanForFirestore(notifData), { merge: true });
      createdCount++;

      // Also automatically notify faculty
      if (tx.facultyEmployeeId) {
        const facReg = tx.facultyEmployeeId.toUpperCase();
        const facNotifId = `auto_due_fac_${tx.id}_${statusType}_${facReg}`;
        const facNotifRef = doc(db, 'notifications', facNotifId);
        const facNotifData: NotificationItem = {
          id: facNotifId,
          targetRegNumber: facReg,
          roleTarget: 'faculty',
          title: `Project Hardware ${status.isOverdue ? 'Overdue' : 'Due Soon'}: ${tx.componentName}`,
          message: `${tx.componentName} issued to student ${tx.studentName} (${tx.studentRegNumber}) under Code ${tx.projectCode} is ${status.isOverdue ? 'overdue' : 'due on ' + status.formattedDate}.`,
          type: statusType,
          projectCode: tx.projectCode || '',
          componentName: tx.componentName,
          dueDate: tx.expectedReturnDate,
          isRead: false,
          createdAt: Timestamp.now(),
          urgency
        };
        batch.set(facNotifRef, cleanForFirestore(facNotifData), { merge: true });
      }
    }

    if (createdCount > 0) {
      await batch.commit();
    }
    return createdCount;
  } catch (error) {
    console.warn("Auto notification check note:", error);
    return 0;
  }
}
