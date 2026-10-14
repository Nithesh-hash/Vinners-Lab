import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  Calendar, 
  UserCheck, 
  Plus, 
  Trash2,
  GraduationCap,
  Phone,
  Mail,
  Clock,
  Copy,
  Check
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Component, Transaction } from '@/types';
import type { UserProfile } from '@/contexts/AuthContext';
import { issueMultipleComponentsToStudent } from '@/lib/projectCodeService';
import { useAuth } from '@/contexts/AuthContext';

// Due date by default is 2 months from today (editable)
function getDefaultTwoMonthDueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

interface IssueToStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Component[];
  transactions?: Transaction[];
  onComponentIssued?: () => void;
}

interface IssueItemRow {
  id: string;
  componentId: string;
  quantity: number;
  customName?: string;
}

export default function IssueToStudentModal({
  isOpen,
  onClose,
  inventory,
  transactions = [],
  onComponentIssued
}: IssueToStudentModalProps) {
  const { profile } = useAuth();

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [registeredStudents, setRegisteredStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [searchError, setSearchError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Issuance state (supports multiple components issued together)
  const [issueItems, setIssueItems] = useState<IssueItemRow[]>([
    { id: 'item_1', componentId: '', quantity: 1 }
  ]);
  const [dueDateStr, setDueDateStr] = useState<string>(getDefaultTwoMonthDueDate());
  const [adminNotes, setAdminNotes] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueSuccessMsg, setIssueSuccessMsg] = useState('');
  const [issueError, setIssueError] = useState('');

  // Real-time listener for registered students from 'users' collection
  useEffect(() => {
    if (!isOpen) return;

    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsub = onSnapshot(q, (snap) => {
      const students = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      // Sort alphabetically by name
      students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setRegisteredStudents(students);
    }, (err) => {
      console.warn("Could not fetch students list:", err);
    });

    return () => unsub();
  }, [isOpen]);

  // Reset modal state on open/close
  useEffect(() => {
    if (!isOpen) {
      setSearchInput('');
      setSelectedStudent(null);
      setIssueItems([{ id: 'item_1', componentId: '', quantity: 1 }]);
      setDueDateStr(getDefaultTwoMonthDueDate());
      setAdminNotes('');
      setIssueSuccessMsg('');
      setIssueError('');
      setSearchError('');
    }
  }, [isOpen]);

  // Filter registered students based on search input
  const filteredStudents = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return [];
    return registeredStudents.filter(s => {
      const name = (s.name || '').toLowerCase();
      const reg = (s.regNumber || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.mobileNumber || '').toLowerCase();
      const code = (s.studentCode || '').toLowerCase();
      return name.includes(q) || reg.includes(q) || email.includes(q) || phone.includes(q) || code.includes(q);
    });
  }, [searchInput, registeredStudents]);

  const handleSelectStudent = (student: UserProfile) => {
    setSelectedStudent(student);
    setSearchError('');
    setIssueSuccessMsg('');
    setIssueError('');
  };

  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchInput.trim().toLowerCase();
    if (!q) {
      setSearchError('Please enter a student name or registration number');
      return;
    }

    const matches = filteredStudents;
    if (matches.length === 1) {
      setSelectedStudent(matches[0]);
      setSearchError('');
    } else if (matches.length === 0) {
      // Check if exact regNumber or studentCode match existed
      const exactMatch = registeredStudents.find(s => 
        (s.regNumber || '').toLowerCase() === q ||
        (s.studentCode || '').toLowerCase() === q
      );
      if (exactMatch) {
        setSelectedStudent(exactMatch);
        setSearchError('');
      } else {
        setSearchError(`No student found matching "${searchInput}". Please ensure the student has registered.`);
      }
    } else {
      setSearchError('');
    }
  };

  // Calculate active loans currently held by the selected student
  const studentActiveLoansCount = useMemo(() => {
    if (!selectedStudent?.regNumber) return 0;
    const cleanReg = selectedStudent.regNumber.trim().toUpperCase();
    return transactions.filter(t => {
      const txReg = (t.studentRegNumber || t.collectedByStudentRegNumber || '').trim().toUpperCase();
      const outstanding = t.quantity - (t.returnedQuantity || 0);
      return txReg === cleanReg && t.status !== 'Returned' && outstanding > 0;
    }).length;
  }, [selectedStudent, transactions]);

  const addIssueItemRow = () => {
    setIssueItems(prev => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), componentId: '', quantity: 1 }
    ]);
  };

  const removeIssueItemRow = (index: number) => {
    if (issueItems.length <= 1) return;
    setIssueItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateIssueItemRow = (index: number, updates: Partial<IssueItemRow>) => {
    setIssueItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleIssueComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setIssueError('Please search and select a student first.');
      return;
    }

    // Validate all items
    for (let i = 0; i < issueItems.length; i++) {
      const row = issueItems[i];
      if (!row.componentId) {
        setIssueError(`Please select a component for Component Item #${i + 1}.`);
        return;
      }
      if (row.componentId === '__OTHER__' && !row.customName?.trim()) {
        setIssueError(`Please manually specify the component name for "Others" in Component Item #${i + 1}.`);
        return;
      }
      if (row.quantity < 1) {
        setIssueError(`Quantity for Component Item #${i + 1} must be at least 1.`);
        return;
      }
    }

    // Check inventory stock and aggregate duplicate component requests
    const itemsToIssue: Array<{ component: Component; quantity: number }> = [];
    const requestedQuantities = new Map<string, number>();

    for (const row of issueItems) {
      if (row.componentId === '__OTHER__') {
        const customComp: Component = {
          id: `other_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: row.customName!.trim(),
          category: 'Others / Custom',
          description: 'Custom specified component',
          totalQuantity: row.quantity,
          availableQuantity: row.quantity,
          issuedQuantity: row.quantity,
          lowStockThreshold: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false
        };
        itemsToIssue.push({ component: customComp, quantity: row.quantity });
      } else {
        const comp = inventory.find(i => i.id === row.componentId);
        if (!comp) {
          setIssueError('One of the selected components was not found in inventory.');
          return;
        }
        const cur = requestedQuantities.get(comp.id) || 0;
        requestedQuantities.set(comp.id, cur + row.quantity);
        itemsToIssue.push({ component: comp, quantity: row.quantity });
      }
    }

    for (const [compId, totalQty] of requestedQuantities.entries()) {
      const comp = inventory.find(i => i.id === compId);
      if (comp && comp.availableQuantity < totalQty) {
        setIssueError(`Insufficient stock for "${comp.name}". Requested ${totalQty}, but only ${comp.availableQuantity} unit(s) available.`);
        return;
      }
    }

    if (!dueDateStr) {
      setIssueError('Please select an expected return due date.');
      return;
    }

    setIsIssuing(true);
    setIssueError('');
    setIssueSuccessMsg('');

    try {
      const selectedDueDate = new Date(`${dueDateStr}T23:59:59`);
      await issueMultipleComponentsToStudent({
        student: {
          uid: selectedStudent.uid,
          name: selectedStudent.name,
          regNumber: selectedStudent.regNumber || '',
          email: selectedStudent.email,
          mobileNumber: selectedStudent.mobileNumber,
          studentCode: selectedStudent.studentCode
        },
        items: itemsToIssue,
        dueDate: selectedDueDate,
        adminId: profile?.uid || 'admin',
        adminName: profile?.name || 'Administrator',
        notes: adminNotes
      });

      const summaryText = itemsToIssue.map(i => `${i.quantity}x "${i.component.name}"`).join(', ');
      setIssueSuccessMsg(`Successfully issued ${itemsToIssue.length} component(s) (${summaryText}) directly to ${selectedStudent.name} (${selectedStudent.regNumber})! This loan now reflects in the student portal.`);
      
      // Reset form
      setIssueItems([{ id: Math.random().toString(36).substring(2, 9), componentId: '', quantity: 1 }]);
      setAdminNotes('');
      setDueDateStr(getDefaultTwoMonthDueDate());

      if (onComponentIssued) {
        onComponentIssued();
      }
    } catch (err: any) {
      console.error("Direct issue error:", err);
      setIssueError(err.message || 'Failed to issue component.');
    } finally {
      setIsIssuing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200/90 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Issue Hardware to Student
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  Direct / Non-SSV & FSV
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Search student by Name or Registration Number to issue components outside project codes
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">

          {/* SEARCH TAB / SECTION */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Search Student (Name or Registration Number) *
            </label>

            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Alex Johnson, 21BCE0001, IIC2026-27-0001..."
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (selectedStudent && e.target.value.trim() !== selectedStudent.name && e.target.value.trim().toUpperCase() !== selectedStudent.regNumber) {
                      // Keep active until user selects another or clears
                    }
                  }}
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-400 shadow-2xs"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchError('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </form>

            {/* SEARCH MATCHES DROPDOWN LIST */}
            {searchInput.trim().length > 0 && !selectedStudent && (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s) => (
                    <button
                      key={s.uid}
                      type="button"
                      onClick={() => handleSelectStudent(s)}
                      className="w-full p-3 text-left hover:bg-emerald-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-800 flex items-center justify-center font-bold text-xs">
                          {s.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-950">
                            {s.name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500">
                            Reg: <strong className="text-slate-700">{s.regNumber}</strong>
                            {s.studentCode && (
                              <span className="ml-1.5 text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {s.studentCode}
                              </span>
                            )}
                            {" "}• {s.email}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600 group-hover:underline">
                        Select →
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No registered student found matching "{searchInput}".
                  </div>
                )}
              </div>
            )}

            {searchError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* WHOLE STUDENT'S DETAILS CARD */}
          {selectedStudent && (
            <div className="rounded-2xl border-2 border-emerald-500/20 bg-emerald-50/30 p-4 sm:p-5 space-y-3.5 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                        {selectedStudent.name}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                        Active Student
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 font-medium">
                      Student record verified in portal
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setSearchInput('');
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-900 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-slate-200 transition-all cursor-pointer self-start sm:self-auto"
                >
                  Change Student
                </button>
              </div>

              {/* Student Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {/* 1. Unique Student Code */}
                <div className="p-3 rounded-xl bg-slate-900 text-white shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Unique Student Code
                  </span>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm font-black text-emerald-400 tracking-wider">
                      {selectedStudent.studentCode || 'Pending Assignment'}
                    </p>
                    {selectedStudent.studentCode && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedStudent.studentCode!);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
                        title="Copy Unique Code"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Reg Number */}
                <div className="p-3 rounded-xl bg-white border border-emerald-100 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Registration No
                  </span>
                  <p className="font-mono text-sm font-extrabold text-slate-900">
                    {selectedStudent.regNumber || 'N/A'}
                  </p>
                </div>

                {/* 3. Mobile Number (Compulsory) */}
                <div className="p-3 rounded-xl bg-white border border-emerald-100 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    Mobile Number
                  </span>
                  <p className="font-mono text-xs font-bold text-slate-900">
                    {selectedStudent.mobileNumber || 'Not registered'}
                  </p>
                </div>

                {/* 4. Official VIT Email */}
                <div className="p-3 rounded-xl bg-white border border-emerald-100 shadow-2xs space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Mail className="w-3 h-3 text-emerald-600" />
                    Student Email (@vitstudent.ac.in)
                  </span>
                  <p className="text-xs font-medium text-slate-800 truncate" title={selectedStudent.email}>
                    {selectedStudent.email || 'N/A'}
                  </p>
                </div>

                {/* 5. Active Loans */}
                <div className="p-3 rounded-xl bg-white border border-emerald-100 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    Active Loans
                  </span>
                  <p className="text-xs font-bold text-slate-900">
                    {studentActiveLoansCount} item{studentActiveLoansCount === 1 ? '' : 's'} in custody
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* COMPONENT & LOAN SCHEDULE FORM (Matches Screenshot 2) */}
          <form onSubmit={handleIssueComponent} className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-white shadow-2xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Component & Loan Schedule
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Add multiple hardware components to be issued together directly to this student
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addIssueItemRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-black text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Component
              </button>
            </div>

            {/* DYNAMIC LIST OF COMPONENTS TO ISSUE */}
            <div className="space-y-3">
              {issueItems.map((item, index) => {
                const selectedComp = inventory.find(i => i.id === item.componentId);
                return (
                  <div 
                    key={item.id} 
                    className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-black">
                          {index + 1}
                        </span>
                        Component Item #{index + 1}
                      </span>

                      {issueItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIssueItemRow(index)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
                          title="Remove component"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Component Selector */}
                      <div className="sm:col-span-8">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Lab Component *
                        </label>
                        <select
                          required
                          value={item.componentId}
                          onChange={e => {
                            updateIssueItemRow(index, { componentId: e.target.value, quantity: 1, customName: '' });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
                        >
                          <option value="">-- Choose hardware component --</option>
                          {inventory.map(comp => (
                            <option 
                              key={comp.id} 
                              value={comp.id}
                              disabled={comp.availableQuantity <= 0}
                            >
                              {comp.name} ({comp.availableQuantity} available) - {comp.category}
                            </option>
                          ))}
                          <option value="__OTHER__">✨ Others (Type manually)</option>
                        </select>

                        {/* Custom name input when 'Others' is selected */}
                        {item.componentId === '__OTHER__' && (
                          <div className="mt-2.5 animate-in fade-in duration-200">
                            <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                              Specify Component Name (Others) *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Type component name manually (e.g. ESP32-CAM, Custom Sensor, Soldering Kit)..."
                              value={item.customName || ''}
                              onChange={e => updateIssueItemRow(index, { customName: e.target.value })}
                              className="w-full px-3.5 py-2 rounded-xl border-2 border-emerald-400 bg-emerald-50/40 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400 shadow-2xs"
                            />
                          </div>
                        )}
                      </div>

                      {/* Quantity to Issue */}
                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Issue Quantity *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={selectedComp ? selectedComp.availableQuantity : 99}
                            required
                            value={item.quantity}
                            onChange={e => updateIssueItemRow(index, { quantity: Math.max(1, Number(e.target.value)) })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
                          />
                          {selectedComp && (
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              / {selectedComp.availableQuantity} max
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add another component dashed button */}
              <button
                type="button"
                onClick={addIssueItemRow}
                className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50/40 hover:bg-slate-100/60 text-slate-700 hover:text-black text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Add Another Component to Issue Together</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* DUE DATE (Default 2 months, editable) */}
              <div className="sm:col-span-2 bg-indigo-50/60 rounded-2xl p-3.5 border border-indigo-100 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Expected Return Due Date *
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                    Default: 2 Months (approx. 60 days) • Fully Editable
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <input
                    type="date"
                    required
                    value={dueDateStr}
                    onChange={e => setDueDateStr(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Automatic due date notifications will be sent directly to the student as the return date approaches.
                  </p>
                </div>
              </div>

              {/* Notes / Purpose */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Purpose / Admin Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Individual lab coursework / workshop testing"
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>

            {/* Error Message */}
            {issueError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{issueError}</span>
              </div>
            )}

            {/* Success Message */}
            {issueSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">{issueSuccessMsg}</p>
                  <p className="text-[11px] text-emerald-700">
                    The student can now view this checkout under "Issued Components" in their dashboard and generate a Return QR pass.
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isIssuing || !selectedStudent || issueItems.some(i => !i.componentId || (i.componentId === '__OTHER__' && !i.customName?.trim()))}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isIssuing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Issuing Hardware...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 text-emerald-300" />
                    Issue {issueItems.length > 1 ? `${issueItems.length} Components Together` : 'Component'} to {selectedStudent?.name || 'Selected Student'}
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
