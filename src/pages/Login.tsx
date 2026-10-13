import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'admin' ? 'admin' : 'student';
  const [loginType, setLoginType] = useState<'student' | 'admin'>(initialType);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'admin' || type === 'student') {
      setLoginType(type);
    }
  }, [searchParams]);

  const handleTypeChange = (type: 'student' | 'admin') => {
    setLoginType(type);
    setSearchParams({ type });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch user profile to route correctly
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        if (profile.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        // Fallback for users without profiles
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      return setError('Please enter your email address to reset password');
    }
    try {
      setError('');
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 md:p-10 border border-slate-100">
        
        {/* Toggle */}
        <div className="flex p-1 bg-slate-100/80 rounded-lg mb-8">
          <button 
            type="button"
            onClick={() => handleTypeChange('student')}
            className={cn("flex-1 py-2 text-sm font-medium rounded-md transition-all", loginType === 'student' ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-700")}
          >
            Student & Faculty
          </button>
          <button 
            type="button"
            onClick={() => handleTypeChange('admin')}
            className={cn("flex-1 py-2 text-sm font-medium rounded-md transition-all", loginType === 'admin' ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-700")}
          >
            Admin login
          </button>
        </div>

        <div className="mb-8">
          <p className="text-slate-500 text-sm mb-1">
            {loginType === 'admin' ? 'Administrative authorization' : 'Please enter your details'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {loginType === 'admin' ? 'Admin Portal' : 'Welcome back'}
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-6 border border-green-100">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400" 
              placeholder="john.doe@example.com" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400" 
              placeholder="••••••••" 
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-slate-600">Remember for 30 days</span>
            </label>
            <button 
              type="button"
              onClick={handleResetPassword}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline text-left sm:text-right"
            >
              Forgot password
            </button>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#3B82F6] hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg transition-colors mt-2 flex justify-center items-center"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (loginType === 'admin' ? 'Sign in as Admin' : 'Sign in')}
          </button>
        </form>

        {loginType === 'student' ? (
          <p className="text-center text-sm text-slate-500 mt-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        ) : (
          <p className="text-center text-xs text-slate-400 mt-8">
            Lab Administrator authorization only · No registration
          </p>
        )}
      </div>
    </div>
  );
}
