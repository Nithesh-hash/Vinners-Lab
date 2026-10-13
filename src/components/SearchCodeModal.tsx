import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  Calendar, 
  Users, 
  Check 
} from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProjectCode, ProjectMember, Component } from '@/types';
import { issueComponentUnderProjectCode, getDueDateStatus } from '@/lib/projectCodeService';
import { useAuth } from '@/contexts/AuthContext';

// Due date by default is 2 months from today (editable)
function getDefaultTwoMonthDueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

interface SearchCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Component[];
  onComponentIssued?: () => void;
  initialCode?: string;
}

export default function SearchCodeModal({
  isOpen,
  onClose,
  inventory,
  onComponentIssued,
  initialCode = ''
}: SearchCodeModalProps) {
  const { profile } = useAuth();

  // Search state
  const [searchCodeInput, setSearchCodeInput] = useState(initialCode);
  const [isSearching, setIsSearching] = useState(false);
  const [activeProjectCode, setActiveProjectCode] = useState<ProjectCode | null>(null);
  const [recentCodes, setRecentCodes] = useState<ProjectCode[]>([]);
  const [searchError, setSearchError] = useState('');

  // Issuance state
  const [selectedStudent, setSelectedStudent] = useState<ProjectMember | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
  const [issueQuantity, setIssueQuantity] = useState<number>(1);
  const [dueDateStr, setDueDateStr] = useState<string>(getDefaultTwoMonthDueDate());
  const [adminNotes, setAdminNotes] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueSuccessMsg, setIssueSuccessMsg] = useState('');
  const [issueError, setIssueError] = useState('');

  const loadRecentCodes = async () => {
    try {
      const q = query(collection(db, 'project_codes'), orderBy('createdAt', 'desc'), limit(5));
      const snap = await getDocs(q);
      const codes = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectCode));
      setRecentCodes(codes);
    } catch (e) {
      console.warn("Could not load recent codes", e);
    }
  };

  const handleSearchCode = async (codeToSearch?: string) => {
    const raw = codeToSearch ?? searchCodeInput;
    const cleanCode = raw.trim().toUpperCase();
    if (!cleanCode) {
      setSearchError('Please enter a project code to search');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setIssueSuccessMsg('');
    setIssueError('');

    try {
      const docRef = doc(db, 'project_codes', cleanCode);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as ProjectCode;
        setActiveProjectCode(data);
        // By default, select the first student in the team
        if (data.students && data.students.length > 0) {
          setSelectedStudent(data.students[0]);
        }
      } else {
        setActiveProjectCode(null);
        setSearchError(`Project code "${cleanCode}" was not found. Please verify the code.`);
      }
    } catch (err: any) {
      setActiveProjectCode(null);
      setSearchError(err.message || 'Error fetching project code.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRecentCodes();
      if (initialCode) {
        setSearchCodeInput(initialCode);
        handleSearchCode(initialCode);
      }
    } else {
      // Reset
      setActiveProjectCode(null);
      setSelectedStudent(null);
      setSelectedComponentId('');
      setIssueQuantity(1);
      setIssueSuccessMsg('');
      setIssueError('');
      setSearchError('');
    }
  }, [isOpen, initialCode]);

  const handleIssueComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectCode) return;
    if (!selectedStudent) {
      setIssueError('Please select which student is collecting the component.');
      return;
    }
    if (!selectedComponentId) {
      setIssueError('Please select a hardware component to issue.');
      return;
    }

    const component = inventory.find(i => i.id === selectedComponentId);
    if (!component) {
      setIssueError('Selected component was not found in inventory.');
      return;
    }

    if (component.availableQuantity < issueQuantity) {
      setIssueError(`Only ${component.availableQuantity} unit(s) available in stock.`);
      return;
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
      await issueComponentUnderProjectCode({
        projectCode: activeProjectCode,
        selectedStudent,
        component,
        quantity: issueQuantity,
        dueDate: selectedDueDate,
        adminId: profile?.uid || 'admin',
        adminName: profile?.name || 'Administrator',
        notes: adminNotes
      });

      // Reload project code to show new issued item
      const updatedSnap = await getDoc(doc(db, 'project_codes', activeProjectCode.code));
      if (updatedSnap.exists()) {
        setActiveProjectCode({ id: updatedSnap.id, ...updatedSnap.data() } as ProjectCode);
      }

      setIssueSuccessMsg(`Successfully issued ${issueQuantity}x "${component.name}" to ${selectedStudent.name} (${selectedStudent.regNumber}) under Code ${activeProjectCode.code}!`);
      setSelectedComponentId('');
      setIssueQuantity(1);
      setAdminNotes('');
      // Reset due date back to default 2 months
      setDueDateStr(getDefaultTwoMonthDueDate());

      if (onComponentIssued) {
        onComponentIssued();
      }
    } catch (err: any) {
      console.error(err);
      setIssueError(err.message || 'Failed to issue component.');
    } finally {
      setIsIssuing(false);
    }
  };

  if (!isOpen) return null;

  const selectedComp = inventory.find(i => i.id === selectedComponentId);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Search className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Search Code & Issue Hardware
              </h3>
              <p className="text-xs text-slate-500">
                Retrieve team authorization code and issue hardware under a student's name
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* SEARCH BAR */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enter Project Code ID
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter Project Code"
                  value={searchCodeInput}
                  onChange={e => setSearchCodeInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchCode();
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs sm:text-sm text-slate-900 uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSearchCode()}
                disabled={isSearching || !searchCodeInput.trim()}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSearching ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    Lookup Code
                  </>
                )}
              </button>
            </div>

            {/* Quick Picker Recent Codes */}
            {recentCodes.length > 0 && !activeProjectCode && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Recent Codes:</span>
                {recentCodes.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSearchCodeInput(c.code);
                      handleSearchCode(c.code);
                    }}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono font-semibold transition-colors cursor-pointer"
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            )}

            {searchError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* ACTIVE PROJECT CODE DETAILS & ISSUANCE FORM */}
          {activeProjectCode && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* CODE HEADER BANNER */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Active Authorization Code
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      AY {activeProjectCode.academicYear}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-wider">
                    {activeProjectCode.code}
                  </h2>
                </div>

                <div className="text-left sm:text-right bg-white/5 p-3 rounded-xl border border-white/10 sm:border-0 sm:bg-transparent sm:p-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Faculty Guide</span>
                  <p className="font-bold text-white text-sm">{activeProjectCode.faculty.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {activeProjectCode.faculty.employeeId} • {activeProjectCode.faculty.mobileNumber}
                  </p>
                </div>
              </div>

              {/* SUCCESS OR ERROR NOTICES */}
              {issueSuccessMsg && (
                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-semibold border border-emerald-200 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Hardware Loan Dispatched</p>
                    <p className="font-normal mt-0.5">{issueSuccessMsg}</p>
                    <p className="text-[11px] text-emerald-600 mt-1">
                      ✓ Instant notifications dispatched to faculty ({activeProjectCode.faculty.name}) and all {activeProjectCode.students.length} team students.
                    </p>
                  </div>
                </div>
              )}

              {issueError && (
                <div className="p-3.5 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{issueError}</span>
                </div>
              )}

              {/* SECTION: SELECT STUDENT TO ISSUE TO */}
              <div className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-white shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Select Collecting Student *
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Component is registered under their name and reflects in all other members' & faculty dashboards
                      </p>
                    </div>
                  </div>

                  {selectedStudent && (
                    <span className="text-[11px] font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      Selected: {selectedStudent.name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {activeProjectCode.students.map((student) => {
                    const isSelected = selectedStudent?.regNumber === student.regNumber;
                    return (
                      <button
                        key={student.regNumber}
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-black bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-xs leading-tight">{student.name}</p>
                            <p className={`font-mono text-[10px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {student.regNumber}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-white text-slate-900 flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        {student.mobileNumber && (
                          <p className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                            📞 {student.mobileNumber}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION: HARDWARE COMPONENT & DUE DATE FORM */}
              <form onSubmit={handleIssueComponent} className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-white shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Component & Loan Schedule
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Default loan due date is 2 months (customizable) with approaching due date notifications
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Component Selector */}
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Lab Component *
                    </label>
                    <select
                      required
                      value={selectedComponentId}
                      onChange={e => {
                        setSelectedComponentId(e.target.value);
                        setIssueQuantity(1);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                    >
                      <option value="">-- Choose hardware component --</option>
                      {inventory.map(item => (
                        <option 
                          key={item.id} 
                          value={item.id}
                          disabled={item.availableQuantity <= 0}
                        >
                          {item.name} ({item.availableQuantity} available) - {item.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity to Issue */}
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Issue Quantity *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={selectedComp ? selectedComp.availableQuantity : 99}
                        required
                        value={issueQuantity}
                        onChange={e => setIssueQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                      />
                      {selectedComp && (
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">
                          / {selectedComp.availableQuantity} max
                        </span>
                      )}
                    </div>
                  </div>

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
                        Automatic due date notifications will be sent to faculty and all team members as the return date approaches.
                      </p>
                    </div>
                  </div>

                  {/* Notes / Project Purpose */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Project Purpose / Admin Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Capstone Project milestone 2 prototype testing"
                      value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isIssuing || !selectedStudent || !selectedComponentId}
                    className="w-full sm:w-auto px-6 py-3 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isIssuing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Issuing Component...
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4 text-emerald-300" />
                        Issue Component to {selectedStudent?.name || 'Selected Student'}
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* SECTION: PREVIOUSLY ISSUED COMPONENTS UNDER THIS CODE */}
              {activeProjectCode.issuedItems && activeProjectCode.issuedItems.length > 0 && (
                <div className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Components Already Issued Under Code {activeProjectCode.code} ({activeProjectCode.issuedItems.length})
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Reflects across all member dashboards
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {activeProjectCode.issuedItems.map((item, idx) => {
                      const dueStatus = getDueDateStatus(item.expectedReturnDate);
                      return (
                        <div key={idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{item.componentName}</span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-[10px] text-slate-700">
                                {item.quantity} unit(s)
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Collected by: <strong className="text-slate-800">{item.collectedByStudentName}</strong> ({item.collectedByStudentRegNumber})
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              dueStatus.isOverdue
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : dueStatus.isNearing
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {dueStatus.isOverdue ? 'Overdue' : dueStatus.isNearing ? `Due in ${dueStatus.daysRemaining}d` : 'Active Loan'}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Due: {dueStatus.formattedDate}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
