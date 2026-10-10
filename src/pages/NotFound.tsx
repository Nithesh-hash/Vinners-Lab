import { Link } from 'react-router-dom';
import { Package2 } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 mb-6">
        <Package2 className="w-10 h-10" />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">404 - Page Not Found</h1>
      <p className="text-lg text-slate-600 mb-8 max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="glass-button">
        Return Home
      </Link>
    </div>
  );
}
