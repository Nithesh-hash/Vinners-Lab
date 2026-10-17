import { useState, useRef, useEffect } from 'react';

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
      {/* Developer Trigger Button with spacious </> icon */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Developer Information"
        title={isOpen ? "Close Developer Info" : "Developer: Nithesh Kumar T"}
        className={`h-9 px-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
          isOpen
            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/20'
            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300 shadow-2xs'
        }`}
      >
        {/* The spacious </> Code Symbol with Clockwise on Open, Anticlockwise on Close */}
        <span
          className="inline-flex items-center justify-center transition-transform duration-500 ease-in-out"
          style={{
            transform: isOpen ? 'rotate(360deg)' : 'rotate(0deg)'
          }}
        >
          <svg 
            viewBox="0 0 32 20" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-5 h-3.5"
          >
            {/* Left bracket < */}
            <polyline points="7.5 4 2 10 7.5 16" />
            {/* Forward slash / */}
            <line x1="12.5" y1="17.5" x2="19.5" y2="2.5" />
            {/* Right bracket > */}
            <polyline points="24.5 4 30 10 24.5 16" />
          </svg>
        </span>
      </button>

      {/* Popover Detail Card - Clean, compact, zero-overflow */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 p-3.5 animate-in fade-in zoom-in-95 duration-150 font-sans text-left">
          {/* Subtle Pointer Arrow */}
          <div className="absolute -top-1.5 right-3.5 w-3 h-3 bg-white border-t border-l border-slate-200 rotate-45"></div>

          <div className="relative space-y-2">
            {/* Top Badge: System Developer / Vinner Lab without gemini icon */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                System Developer
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                Vinner Lab
              </span>
            </div>

            {/* Developer Identity: Name + LinkedIn icon directly after 'T' */}
            <div className="pt-0.5 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
                  Nithesh Kumar T
                </span>
                <a
                  href="https://www.linkedin.com/in/nithesh-kumar-t-b4028130a/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center text-[#0A66C2] hover:text-[#004182] hover:scale-110 active:scale-95 transition-all p-0.5 cursor-pointer shrink-0"
                  title="Connect with Nithesh Kumar T on LinkedIn"
                  aria-label="LinkedIn profile"
                >
                  {/* Official LinkedIn Icon */}
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.205 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Lead Developer & Architect
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


