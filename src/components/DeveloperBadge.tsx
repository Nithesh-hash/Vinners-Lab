import { useState, useRef, useEffect } from 'react';
import { ExternalLink, Sparkles, Code2 } from 'lucide-react';

export default function DeveloperBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggle = () => {
    setIsOpen(prev => !prev);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Developer Trigger Button with </> icon */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Developer Information"
        title={isOpen ? "Close Developer Info" : "Developer: Nithesh Kumar T"}
        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
          isOpen
            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/20'
            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300 shadow-2xs'
        }`}
      >
        {/* The </> Code Symbol with Clockwise on Open, Anticlockwise on Close */}
        <span
          className="inline-flex items-center justify-center transition-transform duration-500 ease-in-out"
          style={{
            transform: isOpen ? 'rotate(360deg)' : 'rotate(0deg)'
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.75" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-4 h-4"
          >
            {/* Left bracket < */}
            <polyline points="8 6 2 12 8 18" />
            {/* Slash / */}
            <line x1="10" y1="20" x2="14" y2="4" />
            {/* Right bracket > */}
            <polyline points="16 18 22 12 16 6" />
          </svg>
        </span>
      </button>

      {/* Popover Detail Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2.5 z-50 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 animate-in fade-in zoom-in-95 duration-200 font-sans text-left">
          {/* Subtle Pointer Arrow */}
          <div className="absolute -top-1.5 right-3.5 w-3 h-3 bg-white border-t border-l border-slate-200 rotate-45"></div>

          <div className="relative space-y-3.5">
            {/* Top Tag & Context */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/70">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>System Developer</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Vinner Lab</span>
            </div>

            {/* Developer Identity with Avatar */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white font-extrabold text-sm flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                NK
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-extrabold text-slate-900 leading-tight truncate">
                  Nithesh Kumar T
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium truncate flex items-center gap-1">
                  <Code2 className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>Lead Developer & Architect</span>
                </p>
              </div>
            </div>

            {/* LinkedIn Action Link */}
            <div className="pt-1">
              <a
                href="https://www.linkedin.com/in/nithesh-kumar-t-b4028130a/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {/* Official LinkedIn Logo */}
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.205 0 22.222 0h.003z"/>
                  </svg>
                  <span>Connect on LinkedIn</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

