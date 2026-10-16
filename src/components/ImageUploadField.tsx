import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, X, Loader2 } from 'lucide-react';
import { compressImage } from '@/utils/imageCompressor';

interface ImageUploadFieldProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  helperText?: string;
}

export default function ImageUploadField({
  value,
  onChange,
  label = 'Component Photo',
  helperText = 'Upload a real photo of the hardware for the catalog & inventory display.'
}: ImageUploadFieldProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }
    setError(null);
    setCompressing(true);
    try {
      const compressedDataUrl = await compressImage(file, 720, 0.82);
      onChange(compressedDataUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to process image');
    } finally {
      setCompressing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput('');
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          {label}
        </label>
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              mode === 'upload'
                ? 'bg-slate-200/90 text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Upload File
          </button>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              mode === 'url'
                ? 'bg-slate-200/90 text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Image Link
          </button>
        </div>
      </div>

      {value ? (
        <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-2 flex items-center gap-3 group">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-white border border-slate-200/80 shrink-0 relative flex items-center justify-center shadow-xs">
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
          <div className="flex-1 min-w-0 pr-8">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              Photo attached
            </p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              Will show on explore cards & dashboard
            </p>
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 underline mt-1 block"
            >
              Change Photo
            </button>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            title="Remove photo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : mode === 'upload' ? (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
              dragActive
                ? 'border-brand-500 bg-brand-50/50'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            {compressing ? (
              <div className="flex flex-col items-center py-2 text-slate-600">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500 mb-1" />
                <span className="text-xs font-semibold">Optimizing photo...</span>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                  <Upload className="w-4 h-4 text-brand-600" />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900 hover:underline">Click to upload</span>
                  <span className="text-slate-500"> or drag and drop</span>
                </div>
                <span className="text-[10px] text-slate-400">PNG, JPG, WEBP (auto-compressed)</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="url"
              placeholder="https://example.com/component.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyUrl}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shrink-0 cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
      <p className="text-[11px] text-slate-400">{helperText}</p>
    </div>
  );
}
