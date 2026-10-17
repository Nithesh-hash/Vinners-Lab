import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { GraduationCap, Briefcase, CheckCircle2, Copy, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNextStudentCode, getAcademicYear } from '@/lib/projectCodeService';
import DeveloperBadge from '@/components/DeveloperBadge';

export default function Register() {
  const [accountType, setAccountType] = useState<'student' | 'faculty'>('student');
  const [formData, setFormData] = useState({
    name: '',
    regNumber: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [createdStudentCode, setCreatedStudentCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    if (!formData.regNumber.trim()) {
      return setError(accountType === 'faculty' ? 'Employee ID is required' : 'Registration number is required');
    }

    const cleanPhone = formData.mobileNumber.trim();
    if (!cleanPhone || cleanPhone.length !== 10 || !/^\d{10}$/.test(cleanPhone)) {
      return setError(accountType === 'faculty' 
        ? 'Faculty mobile number is compulsory and must be exactly 10 digits.' 
        : 'Student mobile number is compulsory and must be exactly 10 digits.');
    }

    const cleanEmail = formData.email.trim().toLowerCase();
    if (accountType === 'student') {
      if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
        return setError('Student email ID must end only at @vitstudent.ac.in');
      }
    }

    setLoading(true);

    try {
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, formData.password);
      const user = userCredential.user;

      // Generate unique student code for student accounts e.g. IIC2026-27-0001
      const studentCode = accountType === 'student' ? await getNextStudentCode() : null;
      const acadYear = getAcademicYear();

      // Create profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: formData.name.trim(),
        email: cleanEmail,
        regNumber: formData.regNumber.trim().toUpperCase(),
        mobileNumber: cleanPhone,
        role: accountType,
        studentCode: studentCode,
        academicYear: acadYear,
        createdAt: new Date()
      });

      if (studentCode) {
        setCreatedStudentCode(studentCode);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  if (createdStudentCode) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-3 sm:p-4 font-sans relative">
        <div className="absolute top-4 right-4 z-20">
          <DeveloperBadge />
        </div>
        <div className="w-full max-w-[480px] bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 md:p-9 border border-slate-200/90 text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Registration Successful
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-3">
              Welcome, {formData.name}!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Your official laboratory member identification code has been generated.
            </p>
          </div>

          {/* CODE DISPLAY BOX */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 shadow-lg">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
              Your Unique Student Code
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-emerald-400">
                {createdStudentCode}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 text-slate-300 text-xs">
              <span className="font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded">AY {getAcademicYear()}</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdStudentCode);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-emerald-500/30"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-left text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Keep this code safe
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Lab admins will use this unique code along with your registration number ({formData.regNumber.toUpperCase()}) to issue authorized hardware components directly to you.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
          >
            <span>Proceed to Student Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-3 sm:p-4 font-sans relative">
      <div className="absolute top-4 right-4 z-20">
        <DeveloperBadge />
      </div>
      <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 md:p-9 border border-slate-200/90">
        
        {/* Role Toggle */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => setAccountType('student')}
            className={cn(
              "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2", 
              accountType === 'student' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <GraduationCap className="w-4 h-4" />
            Student
          </button>
          <button 
            type="button"
            onClick={() => setAccountType('faculty')}
            className={cn(
              "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2", 
              accountType === 'faculty' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Briefcase className="w-4 h-4" />
            Faculty Guide
          </button>
        </div>

        <div className="mb-6">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Create an account</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {accountType === 'faculty' ? 'Faculty Portal Registration' : 'Student Registration'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {accountType === 'faculty' ? 'Register your official faculty account to supervise project hardware.' : 'Register to checkout hardware components and track team loans.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs sm:text-sm mb-5 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              {accountType === 'faculty' ? 'Faculty Name' : 'Full Name'}
            </label>
            <input 
              type="text" 
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-xs sm:text-sm transition-all placeholder:text-slate-400" 
              placeholder={accountType === 'faculty' ? 'Dr. John Doe' : 'Alex Johnson'} 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              {accountType === 'faculty' ? 'Faculty Employee ID (Compulsory)' : 'Registration Number'}
            </label>
            <input 
              type="text" 
              name="regNumber"
              required
              value={formData.regNumber}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-xs sm:text-sm uppercase transition-all placeholder:text-slate-400 font-mono" 
              placeholder={accountType === 'faculty' ? 'EMP5041' : '21BCE0000'} 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mobile Number (Compulsory - 10 Digits)
            </label>
            <input 
              type="tel" 
              name="mobileNumber"
              required
              maxLength={10}
              value={formData.mobileNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData(prev => ({ ...prev, mobileNumber: val }));
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-xs sm:text-sm transition-all placeholder:text-slate-400 font-mono" 
              placeholder="9876543210" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Email address {accountType === 'student' ? '(@vitstudent.ac.in only)' : '(@vit.ac.in)'}
            </label>
            <input 
              type="email" 
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-xs sm:text-sm transition-all placeholder:text-slate-400" 
              placeholder={accountType === 'faculty' ? 'name@vit.ac.in' : 'name@vitstudent.ac.in'} 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password</label>
              <input 
                type="password" 
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-xs sm:text-sm transition-all placeholder:text-slate-400" 
                placeholder="••••••••" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Confirm Password</label>
              <input 
                type="password" 
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-xs sm:text-sm transition-all placeholder:text-slate-400" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all mt-5 flex justify-center items-center shadow-xs cursor-pointer text-xs sm:text-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              accountType === 'faculty' ? 'Register Faculty Account' : 'Create Student Account'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-slate-900 font-bold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
