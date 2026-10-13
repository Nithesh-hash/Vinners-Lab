import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Copy, 
  Check, 
  Users, 
  User,
  GraduationCap, 
  RefreshCw
} from 'lucide-react';
import { getNextProjectCode, verifyUserInPortal, createProjectCodeRecord } from '@/lib/projectCodeService';
import type { ProjectMember, ProjectFaculty, ProjectCode } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface GenerateCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeCreated?: (code: ProjectCode) => void;
}

interface StudentFormItem {
  id: string;
  name: string;
  regNumber: string;
  mobileNumber: string;
  isVerified: boolean;
  verifying: boolean;
  verifiedUser?: any;
  error?: string;
}

export default function GenerateCodeModal({ isOpen, onClose, onCodeCreated }: GenerateCodeModalProps) {
  const { profile } = useAuth();
  
  // Category Step state: 'select_type' (asks SSV or FSV) -> 'fill_form'
  const [step, setStep] = useState<'select_type' | 'fill_form'>('select_type');
  const [codeType, setCodeType] = useState<'SSV' | 'FSV'>('SSV');

  // Code generation state
  const [generatedCode, setGeneratedCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(true);

  // Faculty state (Single faculty, all 3 fields compulsory)
  const [faculty, setFaculty] = useState<ProjectFaculty>({
    name: '',
    employeeId: '',
    mobileNumber: ''
  });
  const [facultyVerifying, setFacultyVerifying] = useState(false);
  const [facultyVerified, setFacultyVerified] = useState(false);
  const [facultyError, setFacultyError] = useState('');

  // Students list state (Dynamic, at least 1, add/delete)
  const [students, setStudents] = useState<StudentFormItem[]>([
    { id: '1', name: '', regNumber: '', mobileNumber: '', isVerified: false, verifying: false }
  ]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCodeResult, setCreatedCodeResult] = useState<ProjectCode | null>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState('');

  const loadNewCode = async (typeToLoad: 'SSV' | 'FSV' = codeType) => {
    setLoadingCode(true);
    try {
      const code = await getNextProjectCode(typeToLoad);
      setGeneratedCode(code);
    } catch {
      setGeneratedCode(`${typeToLoad}2026-27-0001`);
    } finally {
      setLoadingCode(false);
    }
  };

  const handleSelectType = (selected: 'SSV' | 'FSV') => {
    setCodeType(selected);
    loadNewCode(selected);
    setStep('fill_form');
  };

  useEffect(() => {
    if (isOpen) {
      setStep('select_type');
      setCreatedCodeResult(null);
      setFormError('');
    }
  }, [isOpen]);

  // Real-time verification for Faculty
  const handleVerifyFaculty = async (employeeIdToVerify?: string) => {
    const id = employeeIdToVerify ?? faculty.employeeId;
    if (!id.trim()) {
      setFacultyError('Please enter Faculty Employee ID to verify');
      setFacultyVerified(false);
      return;
    }

    setFacultyVerifying(true);
    setFacultyError('');

    try {
      const res = await verifyUserInPortal(id);
      if (res.exists && res.user) {
        setFacultyVerified(true);
        // Auto-fill faculty name and phone if present and blank
        const userMobile = (res.user.mobileNumber || '').replace(/\D/g, '').slice(0, 10);
        setFaculty(prev => ({
          ...prev,
          employeeId: res.user!.regNumber || id.toUpperCase(),
          name: prev.name.trim() ? prev.name : res.user!.name,
          mobileNumber: prev.mobileNumber.trim() ? prev.mobileNumber : userMobile,
          uid: res.user!.uid,
          email: res.user!.email
        }));
      } else {
        setFacultyVerified(false);
        setFacultyError(`No registered user found with Employee ID "${id.toUpperCase()}". Faculty must be registered in the portal.`);
      }
    } catch {
      setFacultyVerified(false);
      setFacultyError('Verification check failed. Please try again.');
    } finally {
      setFacultyVerifying(false);
    }
  };

  // Real-time verification for a Student
  const handleVerifyStudent = async (studentIndex: number, regNumberToVerify?: string) => {
    const targetStudent = students[studentIndex];
    const regNo = regNumberToVerify ?? targetStudent.regNumber;

    if (!regNo.trim()) {
      updateStudent(studentIndex, { error: 'Enter registration number to verify', isVerified: false });
      return;
    }

    updateStudent(studentIndex, { verifying: true, error: undefined });

    try {
      const res = await verifyUserInPortal(regNo);
      if (res.exists && res.user) {
        const userMobile = (res.user.mobileNumber || '').replace(/\D/g, '').slice(0, 10);
        updateStudent(studentIndex, {
          verifying: false,
          isVerified: true,
          verifiedUser: res.user,
          regNumber: res.user.regNumber || regNo.toUpperCase(),
          name: targetStudent.name.trim() ? targetStudent.name : res.user.name,
          mobileNumber: targetStudent.mobileNumber.trim() ? targetStudent.mobileNumber : userMobile,
          error: undefined
        });
      } else {
        updateStudent(studentIndex, {
          verifying: false,
          isVerified: false,
          error: `⚠️ Warning: Student with Reg. No. "${regNo.toUpperCase()}" is not registered in the portal. Please register the student first.`
        });
      }
    } catch {
      updateStudent(studentIndex, {
        verifying: false,
        isVerified: false,
        error: '⚠️ Warning: Verification check failed. Please check network connection and try again.'
      });
    }
  };

  const updateStudent = (index: number, updates: Partial<StudentFormItem>) => {
    setStudents(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const addStudentRow = () => {
    setStudents(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: '',
        regNumber: '',
        mobileNumber: '',
        isVerified: false,
        verifying: false
      }
    ]);
  };

  const removeStudentRow = (index: number) => {
    if (students.length <= 1) return;
    setStudents(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // 1. Validate Faculty (Name, Employee ID, Mobile Number compulsory + strictly 10 digits)
    if (!faculty.name.trim() || !faculty.employeeId.trim() || !faculty.mobileNumber.trim()) {
      setFormError('All 3 faculty fields (Name, Employee ID, Mobile Number) are compulsory.');
      return;
    }

    const facMobile = faculty.mobileNumber.trim();
    if (facMobile.length !== 10 || !/^\d{10}$/.test(facMobile)) {
      setFormError('Faculty mobile number must be exactly 10 digits.');
      return;
    }

    if (!facultyVerified) {
      setFormError(`Faculty with Employee ID "${faculty.employeeId.toUpperCase()}" must be verified in the portal.`);
      return;
    }

    // 2. Validate Students
    if (students.length === 0) {
      setFormError('At least one student must be added.');
      return;
    }

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.name.trim() || !s.regNumber.trim()) {
        setFormError(`Student #${i + 1} Name and Registration Number are required.`);
        return;
      }
      if (!s.isVerified) {
        // Run live verification check on submit in case blur was skipped
        const checkRes = await verifyUserInPortal(s.regNumber.trim());
        if (checkRes.exists && checkRes.user) {
          const userMobile = (checkRes.user.mobileNumber || '').replace(/\D/g, '').slice(0, 10);
          updateStudent(i, {
            isVerified: true,
            verifiedUser: checkRes.user,
            regNumber: checkRes.user.regNumber || s.regNumber.trim().toUpperCase(),
            name: s.name.trim() ? s.name : checkRes.user.name,
            mobileNumber: s.mobileNumber.trim() ? s.mobileNumber : userMobile,
            error: undefined
          });
        } else {
          const warnMsg = `⚠️ Warning: Student with Reg. No. "${s.regNumber.trim().toUpperCase()}" is not registered in the portal. Please register the student first.`;
          updateStudent(i, { error: warnMsg });
          setFormError(warnMsg);
          return;
        }
      }
    }

    // Check duplicate student reg numbers
    const regNumbers = students.map(s => s.regNumber.trim().toUpperCase());
    const uniqueRegs = new Set(regNumbers);
    if (uniqueRegs.size !== regNumbers.length) {
      setFormError('Duplicate student registration numbers are not allowed.');
      return;
    }

    // 3. Condition: Validate student mobile numbers (strictly 10 digits if entered; at least 1 student mobile is mandatory)
    let validStudentMobileCount = 0;
    for (let i = 0; i < students.length; i++) {
      const sMobile = students[i].mobileNumber.trim();
      if (sMobile) {
        if (sMobile.length !== 10 || !/^\d{10}$/.test(sMobile)) {
          setFormError(`Student #${i + 1} (${students[i].name || students[i].regNumber}) mobile number must be exactly 10 digits.`);
          return;
        }
        validStudentMobileCount++;
      }
    }

    if (validStudentMobileCount === 0) {
      setFormError('At least ONE student must provide a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const studentMembers: ProjectMember[] = students.map(s => {
        const item: ProjectMember = {
          name: s.name.trim(),
          regNumber: s.regNumber.trim().toUpperCase()
        };
        const m = s.mobileNumber.trim();
        if (m) {
          item.mobileNumber = m;
        }
        if (s.verifiedUser?.email) {
          item.email = s.verifiedUser.email;
        }
        if (s.verifiedUser?.uid) {
          item.uid = s.verifiedUser.uid;
        }
        return item;
      });

      const facultyMember: ProjectFaculty = {
        name: faculty.name.trim(),
        employeeId: faculty.employeeId.trim().toUpperCase(),
        mobileNumber: facMobile
      };
      if (faculty.uid) {
        facultyMember.uid = faculty.uid;
      }
      if (faculty.email) {
        facultyMember.email = faculty.email;
      }

      const result = await createProjectCodeRecord({
        code: generatedCode,
        codeType,
        faculty: facultyMember,
        students: studentMembers,
        adminId: profile?.uid || 'admin',
        adminName: profile?.name || 'Administrator'
      });

      setCreatedCodeResult(result);
      if (onCodeCreated) {
        onCodeCreated(result);
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to generate code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!createdCodeResult) return;
    navigator.clipboard.writeText(createdCodeResult.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCreatedCodeResult(null);
    setFormError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className={`bg-white rounded-3xl shadow-2xl w-full ${step === 'select_type' ? 'max-w-sm' : 'max-w-2xl'} max-h-[92dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-200`}>
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Generate Project Authorization Code
              </h3>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {step === 'select_type' ? (
          /* STEP 1: ASKS SSV OR FSV BUTTON SELECTION (Blue & Orange Pill Buttons matching reference) */
          <div className="p-7 flex flex-col items-center justify-center bg-slate-50/70">
            <div className="flex flex-col items-center gap-3.5">
              {/* SSV Button - Blue Pill with White Circle User Badge */}
              <button
                type="button"
                onClick={() => handleSelectType('SSV')}
                className="group relative w-36 py-1.5 pl-1.5 pr-4 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-3.5 select-none"
              >
                <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-4.5 h-4.5 stroke-[2.3]" />
                </div>
                <span className="font-bold tracking-widest text-base font-mono">SSV</span>
              </button>

              {/* FSV Button - Orange Pill with White Circle User Badge */}
              <button
                type="button"
                onClick={() => handleSelectType('FSV')}
                className="group relative w-36 py-1.5 pl-1.5 pr-4 rounded-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-3.5 select-none"
              >
                <div className="w-8 h-8 rounded-full bg-white text-orange-500 flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-4.5 h-4.5 stroke-[2.3]" />
                </div>
                <span className="font-bold tracking-widest text-base font-mono">FSV</span>
              </button>
            </div>
          </div>
        ) : createdCodeResult ? (
          /* SUCCESS SCREEN */
          <div className="p-6 sm:p-8 space-y-6 text-center overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {createdCodeResult.codeType || 'Project'} Code Successfully Generated
              </span>
              <h2 className="text-3xl sm:text-4xl font-mono font-extrabold text-slate-900 tracking-wider mt-3">
                {createdCodeResult.code}
              </h2>
              <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                This code is now active and immediately reflects across all registered students' and faculty dashboards.
              </p>
            </div>

            {/* Quick Action Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied to Clipboard!' : 'Copy Code ID'}
              </button>
            </div>

            {/* Summary details */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 text-left space-y-3 text-xs">
              <div className="flex items-start justify-between border-b border-slate-200/60 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Faculty Guide (1)</span>
                  <p className="font-bold text-slate-900 text-sm">{createdCodeResult.faculty.name}</p>
                  <p className="text-slate-500 font-mono">ID: {createdCodeResult.faculty.employeeId} • {createdCodeResult.faculty.mobileNumber}</p>
                </div>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Verified
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registered Students ({createdCodeResult.students.length})</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                  {createdCodeResult.students.map((s, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{s.name}</p>
                        <p className="text-slate-500 font-mono text-[10px]">{s.regNumber}</p>
                      </div>
                      {s.mobileNumber && (
                        <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                          {s.mobileNumber}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
            >
              Done & Return to Dashboard
            </button>
          </div>
        ) : (
          /* FORM BODY (STEP 2) */
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
            
            {/* Top Bar with Back Link */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('select_type')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                ← Back
              </button>
            </div>

            {/* Generated Code Preview Bar */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Target Generated Code ({codeType})
                </span>
                <div className="text-xl sm:text-2xl font-mono font-extrabold text-amber-300 tracking-wider">
                  {loadingCode ? 'Generating sequence...' : generatedCode}
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => loadNewCode(codeType)}
                disabled={loadingCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors w-fit cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCode ? 'animate-spin' : ''}`} />
                Refresh Sequence
              </button>
            </div>

            {formError && (
              <div className="bg-amber-50 text-amber-900 p-3.5 rounded-xl text-xs font-semibold border border-amber-300 flex items-start gap-2 shadow-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* SECTION 1: FACULTY DETAILS (Compulsory 3 fields, Exactly 1 Faculty) */}
            <div className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-white shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Faculty Guide Details</h4>
                  </div>
                </div>

                {facultyVerified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified in Portal
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400">
                    Verification Required
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Employee ID with Verification */}
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Employee ID *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP1045"
                      value={faculty.employeeId}
                      onChange={e => {
                        const val = e.target.value.toUpperCase();
                        setFaculty(prev => ({ ...prev, employeeId: val }));
                        setFacultyVerified(false);
                      }}
                      onBlur={() => {
                        if (faculty.employeeId.trim() && !facultyVerified) {
                          handleVerifyFaculty(faculty.employeeId);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyFaculty()}
                      disabled={facultyVerifying || !faculty.employeeId.trim()}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-[10px] font-bold text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {facultyVerifying ? 'Checking...' : 'Verify'}
                    </button>
                  </div>
                </div>

                {/* Faculty Name */}
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Faculty Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Dr. S. Kumar"
                    value={faculty.name}
                    onChange={e => setFaculty(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Faculty Mobile Number */}
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mobile Number (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={faculty.mobileNumber}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFaculty(prev => ({ ...prev, mobileNumber: val }));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              {facultyError && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {facultyError}
                </p>
              )}
            </div>

            {/* SECTION 2: STUDENTS DETAILS (Dynamic add/delete, verified via Reg. No) */}
            <div className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-white shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Student Team Members</h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addStudentRow}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-black text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Student
                </button>
              </div>

              <div className="space-y-3">
                {students.map((student, index) => (
                  <div 
                    key={student.id} 
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        Student #{index + 1}
                        {student.isVerified && (
                          <span className="text-emerald-600 font-normal inline-flex items-center gap-0.5 text-[10px]">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </span>

                      {students.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStudentRow(index)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
                          title="Remove student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Registration Number with verification */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Reg. Number *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="21BCE1042"
                            value={student.regNumber}
                            onChange={e => {
                              const val = e.target.value.toUpperCase();
                              updateStudent(index, { regNumber: val, isVerified: false, error: undefined });
                            }}
                            onBlur={() => {
                              if (student.regNumber.trim() && !student.isVerified) {
                                handleVerifyStudent(index, student.regNumber);
                              }
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-900 uppercase focus:outline-none focus:ring-1 focus:ring-black pr-14"
                          />
                          <button
                            type="button"
                            onClick={() => handleVerifyStudent(index)}
                            disabled={student.verifying || !student.regNumber.trim()}
                            className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {student.verifying ? '...' : 'Verify'}
                          </button>
                        </div>
                      </div>

                      {/* Student Name */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Student Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Alex Johnson"
                          value={student.name}
                          onChange={e => updateStudent(index, { name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>

                      {/* Mobile Number (any 1 is enough) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Mobile Number (10 Digits, Any 1 required)
                        </label>
                        <input
                          type="tel"
                          maxLength={10}
                          placeholder="10-digit mobile (optional)"
                          value={student.mobileNumber}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            updateStudent(index, { mobileNumber: val });
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    </div>

                    {student.error && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{student.error}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5 shrink-0 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || loadingCode}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating Code...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-white" />
                    Generate & Activate Code
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
