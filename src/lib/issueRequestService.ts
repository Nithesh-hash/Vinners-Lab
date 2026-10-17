import { 
  collection, 
  query, 
  getDocs, 
  getDoc, 
  doc, 
  writeBatch, 
  Timestamp, 
  orderBy, 
  limit,
  updateDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import type { 
  IssueRequest, 
  IssueRequestItem, 
  Component, 
  NotificationItem, 
  ProjectCode, 
  ProjectIssuedItem, 
  Transaction 
} from '@/types';
import { cleanForFirestore, getAcademicYear } from './projectCodeService';

/**
 * Computes next sequential Request Code, e.g. "REQ2026-27-0001"
 */
export async function getNextRequestCode(): Promise<string> {
  const acadYear = getAcademicYear();
  const prefix = `REQ${acadYear}-`;

  try {
    const q = query(
      collection(db, 'issue_requests'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);

    let maxNum = 0;
    snap.docs.forEach(d => {
      const code = (d.data().requestCode || '') as string;
      if (code && code.startsWith(prefix)) {
        const parts = code.split('-');
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
    console.warn("Could not query issue_requests sequence:", error);
    return `${prefix}0001`;
  }
}

/**
 * Submits a new Issue Request from a student or faculty member.
 */
export async function submitIssueRequest(params: {
  requesterUid: string;
  requesterName: string;
  requesterRegNumber: string;
  requesterEmail?: string;
  requesterMobile?: string;
  requesterRole: 'student' | 'faculty';
  studentCode?: string;
  projectCode?: string;
  recipientType?: 'student' | 'faculty';
  recipientName?: string;
  recipientRegNumber?: string;
  items: Array<{
    component: Component;
    requestedQuantity: number;
    notes?: string;
  }>;
  purposeNotes?: string;
}): Promise<IssueRequest> {
  const {
    requesterUid,
    requesterName,
    requesterRegNumber,
    requesterEmail,
    requesterMobile,
    requesterRole,
    studentCode,
    projectCode,
    recipientType,
    recipientName,
    recipientRegNumber,
    items,
    purposeNotes
  } = params;

  if (!items || items.length === 0) {
    throw new Error('At least one component must be selected for the issue request.');
  }

  // Validate quantities
  for (const it of items) {
    if (it.requestedQuantity < 1) {
      throw new Error(`Quantity for "${it.component.name}" must be at least 1.`);
    }
  }

  const requestCode = await getNextRequestCode();
  const reqRef = doc(collection(db, 'issue_requests'));

  const formattedItems: IssueRequestItem[] = items.map(it => ({
    componentId: it.component.id,
    componentCode: it.component.code || undefined,
    componentName: it.component.name,
    category: it.component.category || undefined,
    imageUrl: it.component.imageUrl || undefined,
    requestedQuantity: it.requestedQuantity,
    approvedQuantity: it.requestedQuantity, // initially equal to requested quantity
    issuedQuantity: 0,
    notes: it.notes || undefined
  }));

  const newRequest: IssueRequest = {
    id: reqRef.id,
    requestCode,
    requesterUid,
    requesterName: requesterName.trim(),
    requesterRegNumber: requesterRegNumber.trim().toUpperCase(),
    requesterEmail: (requesterEmail || '').trim().toLowerCase() || undefined,
    requesterMobile: requesterMobile || undefined,
    requesterRole,
    studentCode: studentCode || undefined,
    projectCode: projectCode ? projectCode.trim().toUpperCase() : undefined,
    recipientType: recipientType || requesterRole,
    recipientName: recipientName ? recipientName.trim() : requesterName.trim(),
    recipientRegNumber: recipientRegNumber ? recipientRegNumber.trim().toUpperCase() : requesterRegNumber.trim().toUpperCase(),
    items: formattedItems,
    purposeNotes: purposeNotes?.trim() || undefined,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    logs: [
      {
        timestamp: Timestamp.now(),
        action: 'submitted',
        actorId: requesterUid,
        actorName: requesterName.trim(),
        actorRole: requesterRole,
        note: `Submitted issue request for ${items.length} component type(s) (${items.reduce((acc, i) => acc + i.requestedQuantity, 0)} total units)`
      }
    ]
  };

  const batch = writeBatch(db);
  batch.set(reqRef, cleanForFirestore(newRequest));

  // Dispatch alert notification to Administrators
  const notifRef = doc(collection(db, 'notifications'));
  const notifData: NotificationItem = {
    id: notifRef.id,
    roleTarget: 'admin',
    title: `New Hardware Issue Request: ${requestCode}`,
    message: `${requesterName} (${requesterRegNumber}) requested ${items.length} component(s)${projectCode ? ` under Code ${projectCode}` : ''}. Review & approve in Admin Portal.`,
    type: 'issue_request_submitted',
    requestId: reqRef.id,
    projectCode: projectCode ? projectCode.trim().toUpperCase() : undefined,
    isRead: false,
    createdAt: Timestamp.now(),
    urgency: 'info'
  };
  batch.set(notifRef, cleanForFirestore(notifData));

  await batch.commit();
  return newRequest;
}

/**
 * Admin updates component counts or removes components from an Issue Request.
 */
export async function adminUpdateIssueRequestItems(params: {
  requestId: string;
  items: IssueRequestItem[];
  adminNotes?: string;
  adminId: string;
  adminName: string;
}): Promise<void> {
  const { requestId, items, adminNotes, adminId, adminName } = params;

  if (!items || items.length === 0) {
    throw new Error('An issue request must have at least one component. If denying all items, use Reject Request.');
  }

  const reqRef = doc(db, 'issue_requests', requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) {
    throw new Error('Issue request was not found.');
  }

  const existing = snap.data() as IssueRequest;
  const logs = existing.logs || [];

  logs.push({
    timestamp: Timestamp.now(),
    action: 'updated',
    actorId: adminId,
    actorName: adminName,
    actorRole: 'admin',
    note: adminNotes || 'Admin adjusted item quantities or removed components'
  });

  await updateDoc(reqRef, cleanForFirestore({
    items,
    adminNotes: adminNotes || existing.adminNotes || undefined,
    updatedAt: Timestamp.now(),
    logs
  }));
}

/**
 * Admin processes/approves an Issue Request.
 * Updates item quantities (if modified), marks status as 'approved',
 * and dispatches notification to the requester with pickup instructions.
 */
export async function adminProcessIssueRequest(params: {
  requestId: string;
  approvedItems: IssueRequestItem[];
  adminNotes?: string;
  adminId: string;
  adminName: string;
}): Promise<void> {
  const { requestId, approvedItems, adminNotes, adminId, adminName } = params;

  if (!approvedItems || approvedItems.length === 0) {
    throw new Error('Cannot approve an empty request. If rejecting all items, please click Reject.');
  }

  // Ensure every item has an approvedQuantity >= 1
  const cleanedItems = approvedItems.map(it => ({
    ...it,
    approvedQuantity: Math.max(1, Number(it.approvedQuantity ?? it.requestedQuantity) || 1),
    issuedQuantity: it.issuedQuantity || 0
  }));

  const reqRef = doc(db, 'issue_requests', requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) {
    throw new Error('Issue request was not found.');
  }

  const existing = snap.data() as IssueRequest;
  const logs = existing.logs || [];

  logs.push({
    timestamp: Timestamp.now(),
    action: 'approved',
    actorId: adminId,
    actorName: adminName,
    actorRole: 'admin',
    note: adminNotes || 'Admin processed and approved hardware request'
  });

  const batch = writeBatch(db);

  batch.update(reqRef, cleanForFirestore({
    items: cleanedItems,
    status: 'approved',
    adminNotes: adminNotes || existing.adminNotes || undefined,
    approvedAt: Timestamp.now(),
    approvedByAdminId: adminId,
    approvedByAdminName: adminName,
    updatedAt: Timestamp.now(),
    logs
  }));

  // Send real-time notification to requester
  const notifRef = doc(collection(db, 'notifications'));
  const notifData: NotificationItem = {
    id: notifRef.id,
    userId: existing.requesterUid,
    targetRegNumber: existing.requesterRegNumber,
    roleTarget: existing.requesterRole,
    title: `Issue Request ${existing.requestCode} Approved!`,
    message: `Your hardware request has been approved by the Lab Admin. Show your Request QR pass to the lab admin to collect your components.`,
    type: 'issue_request_approved',
    requestId,
    projectCode: existing.projectCode,
    isRead: false,
    createdAt: Timestamp.now(),
    urgency: 'info'
  };
  batch.set(notifRef, cleanForFirestore(notifData));

  await batch.commit();
}

/**
 * Admin rejects an Issue Request with a reason.
 */
export async function adminRejectIssueRequest(params: {
  requestId: string;
  reason: string;
  adminId: string;
  adminName: string;
}): Promise<void> {
  const { requestId, reason, adminId, adminName } = params;

  const reqRef = doc(db, 'issue_requests', requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) {
    throw new Error('Issue request was not found.');
  }

  const existing = snap.data() as IssueRequest;
  const logs = existing.logs || [];

  logs.push({
    timestamp: Timestamp.now(),
    action: 'rejected',
    actorId: adminId,
    actorName: adminName,
    actorRole: 'admin',
    note: reason || 'Admin declined hardware request'
  });

  const batch = writeBatch(db);

  batch.update(reqRef, cleanForFirestore({
    status: 'rejected',
    rejectionReason: reason || 'Unavailable stock or administrative decision',
    updatedAt: Timestamp.now(),
    logs
  }));

  // Send notification to requester
  const notifRef = doc(collection(db, 'notifications'));
  const notifData: NotificationItem = {
    id: notifRef.id,
    userId: existing.requesterUid,
    targetRegNumber: existing.requesterRegNumber,
    roleTarget: existing.requesterRole,
    title: `Issue Request ${existing.requestCode} Declined`,
    message: `Your hardware request was declined by the lab admin: "${reason || 'Stock unavailable'}". Contact the lab administrator for queries.`,
    type: 'issue_request_rejected',
    requestId,
    projectCode: existing.projectCode,
    isRead: false,
    createdAt: Timestamp.now(),
    urgency: 'danger'
  };
  batch.set(notifRef, cleanForFirestore(notifData));

  await batch.commit();
}

/**
 * Handover & Checkout Console:
 * Admin scans the Request QR at the counter and hands over components.
 * Admin can adjust quantities handed over now ("becoz sometimes few components won't be there").
 * If all approved items are issued -> 'completed'.
 * If partial items remain -> 'partially_issued' (student can bring QR next time).
 */
export async function checkoutIssueRequestAtCounter(params: {
  request: IssueRequest;
  itemsToIssueNow: Array<{
    componentId: string;
    quantityToIssue: number;
  }>;
  dueDate: Date;
  adminId: string;
  adminName: string;
  handoverNotes?: string;
}): Promise<{
  allCompleted: boolean;
  totalUnitsIssuedNow: number;
  remainingUnits: number;
  transactionIds: string[];
}> {
  const { request, itemsToIssueNow, dueDate, adminId, adminName, handoverNotes } = params;

  // Filter items where quantityToIssue > 0
  const activeItemsToIssue = itemsToIssueNow.filter(i => i.quantityToIssue > 0);
  if (activeItemsToIssue.length === 0) {
    throw new Error('Please select at least one component with quantity greater than 0 to issue.');
  }

  // 1. Verify availability in inventory
  for (const it of activeItemsToIssue) {
    const compRef = doc(db, 'inventory', it.componentId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      throw new Error(`Component with ID ${it.componentId} not found in inventory.`);
    }
    const compData = compSnap.data() as Component;
    if (compData.availableQuantity < it.quantityToIssue) {
      throw new Error(`Insufficient stock for "${compData.name}". Available: ${compData.availableQuantity}, requested to issue: ${it.quantityToIssue}.`);
    }
  }

  // 2. Fetch Project Code if applicable
  let projectCodeDoc: ProjectCode | null = null;
  if (request.projectCode) {
    const pSnap = await getDoc(doc(db, 'project_codes', request.projectCode));
    if (pSnap.exists()) {
      projectCodeDoc = { id: pSnap.id, ...pSnap.data() } as ProjectCode;
    }
  }

  const batch = writeBatch(db);
  const dueTimestamp = Timestamp.fromDate(dueDate);
  const txIds: string[] = [];
  const projectIssuedItems: ProjectIssuedItem[] = [];

  const recipientName = request.recipientName || request.requesterName;
  const recipientReg = (request.recipientRegNumber || request.requesterRegNumber).trim().toUpperCase();
  const recipientRole = request.recipientType || request.requesterRole;

  // 3. Create transactions & deduct inventory
  for (const it of activeItemsToIssue) {
    const reqItem = request.items.find(ri => ri.componentId === it.componentId);
    const compRef = doc(db, 'inventory', it.componentId);
    const compSnap = await getDoc(compRef);
    const compData = compSnap.data() as Component;

    const txRef = doc(collection(db, 'transactions'));
    txIds.push(txRef.id);

    const txData: Partial<Transaction> = {
      id: txRef.id,
      componentId: it.componentId,
      componentCode: compData.code || reqItem?.componentCode || undefined,
      componentName: compData.name || reqItem?.componentName || 'Hardware Component',
      studentId: request.requesterUid,
      studentName: recipientName,
      studentRegNumber: recipientReg,
      studentEmail: request.requesterEmail,
      studentMobile: request.requesterMobile,
      studentCode: request.studentCode,
      quantity: it.quantityToIssue,
      returnedQuantity: 0,
      expectedReturnDate: dueTimestamp,
      issueDate: Timestamp.now(),
      status: 'Checked Out',
      issuedByAdminId: adminId,
      issuedByAdminName: adminName,
      adminNotes: handoverNotes || `Issued via Request Pass ${request.requestCode}`,
      projectPurpose: request.purposeNotes || `Issue Request ${request.requestCode}`,
      collectedByStudentName: recipientName,
      collectedByStudentRegNumber: recipientReg,
      // Project Code linkage
      projectCode: request.projectCode ? request.projectCode.trim().toUpperCase() : undefined
    };

    if (projectCodeDoc) {
      txData.facultyEmployeeId = (projectCodeDoc.facultyEmployeeId || projectCodeDoc.faculty?.employeeId || '').trim().toUpperCase();
      txData.facultyName = projectCodeDoc.faculty?.name;
      txData.facultyMobile = projectCodeDoc.faculty?.mobileNumber;
      txData.teamStudentRegNumbers = projectCodeDoc.studentRegNumbers || projectCodeDoc.students?.map(s => s.regNumber);
      txData.teamStudents = projectCodeDoc.students;
    }

    batch.set(txRef, cleanForFirestore(txData));

    // Deduct availableQuantity and increment issuedQuantity in inventory
    batch.update(compRef, cleanForFirestore({
      availableQuantity: compData.availableQuantity - it.quantityToIssue,
      issuedQuantity: compData.issuedQuantity + it.quantityToIssue,
      updatedAt: Timestamp.now()
    }));

    if (request.projectCode) {
      projectIssuedItems.push({
        transactionId: txRef.id,
        componentId: it.componentId,
        componentName: compData.name || reqItem?.componentName || 'Hardware Component',
        quantity: it.quantityToIssue,
        returnedQuantity: 0,
        collectedByStudentName: recipientName,
        collectedByStudentRegNumber: recipientReg,
        issueDate: Timestamp.now(),
        expectedReturnDate: dueTimestamp,
        status: 'Checked Out'
      });
    }
  }

  // 4. If project code exists, sync project_codes.issuedItems
  if (projectCodeDoc && projectIssuedItems.length > 0) {
    const codeRef = doc(db, 'project_codes', projectCodeDoc.code);
    const existingItems = projectCodeDoc.issuedItems || [];
    batch.update(codeRef, cleanForFirestore({
      issuedItems: [...existingItems, ...projectIssuedItems],
      updatedAt: Timestamp.now()
    }));
  }

  // 5. Update issue_requests status and item counts
  let allCompleted = true;
  let remainingUnits = 0;
  let totalUnitsIssuedNow = 0;

  const updatedItems: IssueRequestItem[] = request.items.map(origItem => {
    const issueMatch = activeItemsToIssue.find(i => i.componentId === origItem.componentId);
    const unitsIssuedNow = issueMatch ? issueMatch.quantityToIssue : 0;
    totalUnitsIssuedNow += unitsIssuedNow;

    const approvedQty = origItem.approvedQuantity ?? origItem.requestedQuantity;
    const previouslyIssued = origItem.issuedQuantity || 0;
    const newTotalIssued = previouslyIssued + unitsIssuedNow;

    const remainingForItem = Math.max(0, approvedQty - newTotalIssued);
    remainingUnits += remainingForItem;

    if (remainingForItem > 0) {
      allCompleted = false;
    }

    return {
      ...origItem,
      approvedQuantity: approvedQty,
      issuedQuantity: newTotalIssued
    };
  });

  const newStatus = allCompleted ? 'completed' : 'partially_issued';
  const logs = request.logs || [];

  logs.push({
    timestamp: Timestamp.now(),
    action: allCompleted ? 'completed' : 'partially_issued',
    actorId: adminId,
    actorName: adminName,
    actorRole: 'admin',
    note: handoverNotes || (allCompleted 
      ? `All ${totalUnitsIssuedNow} approved units handed over successfully.` 
      : `Handed over ${totalUnitsIssuedNow} units. ${remainingUnits} unit(s) remaining for future pickup.`),
    itemsIssued: activeItemsToIssue.map(i => {
      const it = request.items.find(ri => ri.componentId === i.componentId);
      return {
        componentId: i.componentId,
        componentName: it?.componentName || 'Component',
        quantity: i.quantityToIssue
      };
    })
  });

  const reqRef = doc(db, 'issue_requests', request.id);
  batch.update(reqRef, cleanForFirestore({
    items: updatedItems,
    status: newStatus,
    updatedAt: Timestamp.now(),
    logs
  }));

  // 6. Notifications to recipient
  const notifRef = doc(collection(db, 'notifications'));
  const notifData: NotificationItem = {
    id: notifRef.id,
    userId: request.requesterUid,
    targetRegNumber: recipientReg,
    roleTarget: recipientRole,
    title: allCompleted 
      ? `Hardware Checkout Complete (${request.requestCode})` 
      : `Partial Hardware Handover (${request.requestCode})`,
    message: allCompleted
      ? `All approved components have been handed over by the lab admin. Return due date: ${dueDate.toLocaleDateString()}.`
      : `${totalUnitsIssuedNow} component unit(s) handed over. ${remainingUnits} unit(s) remain pending. Present your Request QR next time to collect remaining items.`,
    type: allCompleted ? 'issue_request_completed' : 'issue_request_partially_issued',
    requestId: request.id,
    projectCode: request.projectCode,
    dueDate: dueTimestamp,
    isRead: false,
    createdAt: Timestamp.now(),
    urgency: 'info'
  };
  batch.set(notifRef, cleanForFirestore(notifData));

  await batch.commit();

  return {
    allCompleted,
    totalUnitsIssuedNow,
    remainingUnits,
    transactionIds: txIds
  };
}
