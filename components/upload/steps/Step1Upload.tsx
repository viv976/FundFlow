'use client';

import React, { useRef, useState } from 'react';
import { validateFileConstraints } from '@/lib/finance/data-pipeline/parser';

interface Step1UploadProps {
  onFileLoaded: (file: File, content: string) => void;
  currency: string;
}

export const Step1Upload: React.FC<Step1UploadProps> = ({ onFileLoaded, currency }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = (file: File) => {
    setError(null);
    const validation = validateFileConstraints(file);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || !content.trim()) {
        setError('CSV file is empty. Please upload a file containing transaction data.');
        return;
      }
      onFileLoaded(file, content);
    };
    reader.onerror = () => {
      setError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface font-headline-md">
              Step 1: Upload Bank or Financial CSV
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Select a standard comma-separated export from your banking provider, accounting platform, or expense manager.
            </p>
          </div>
          <span className="text-xs font-mono-data text-secondary-fixed bg-primary px-3 py-1 rounded font-bold">
            {currency} Ledger
          </span>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl text-xs bg-error-container/40 text-error border border-error/30 flex items-center gap-2.5 animate-fadeIn">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all border-2 border-dashed ${
            isDragOver
              ? 'border-primary bg-primary/5 scale-[0.99]'
              : 'border-outline-variant bg-surface-bright hover:border-primary/50 hover:bg-surface-container-low/40'
          }`}
        >
          <span className="material-symbols-outlined text-[52px] text-primary mb-3">
            cloud_upload
          </span>
          <p className="text-base font-semibold text-on-surface mb-1">
            Drag and drop your CSV file here
          </p>
          <p className="text-xs text-on-surface-variant mb-5">
            or click anywhere to browse from your computer
          </p>

          <input
            type="file"
            accept=".csv,text/csv"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                processFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <button
            type="button"
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm cursor-pointer"
          >
            Select CSV File
          </button>
        </div>

        <div className="mt-4 flex justify-between items-center text-on-surface-variant text-xs">
          <span>Supported formats: <strong>.csv</strong></span>
          <span>Maximum file size: <strong>50MB</strong></span>
        </div>
      </div>
    </div>
  );
};
