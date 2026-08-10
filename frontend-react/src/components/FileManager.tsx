import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Trash2, File, Loader2 } from 'lucide-react';

interface FileManagerProps {
  files: string[];
  isUploading: boolean;
  onUpload: (files: FileList) => void;
  onDelete: (name: string) => void;
}

export const FileManager: React.FC<FileManagerProps> = ({ files, isUploading, onUpload, onDelete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
        Knowledge Base
      </h3>
      
      <div 
        className={`
          relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
          ${isDragging 
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' 
            : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-alt)]'}
          ${isUploading ? 'opacity-75 cursor-wait' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInput} 
          className="hidden" 
          multiple 
          accept=".txt,.pdf,.md,.csv,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-[var(--color-accent)]">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm font-medium">Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
            <UploadCloud size={24} />
            <div className="text-sm">
              <span className="font-semibold text-[var(--color-accent)]">Click to upload</span> or drag and drop
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">PDF, TXT, MD up to 10MB</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <AnimatePresence>
          {files.map((file) => (
            <motion.div
              key={file}
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="flex items-center justify-between p-2.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] group"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <File size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
                <span className="text-sm text-[var(--color-text)] truncate">{file}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(file); }}
                className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                title="Remove file"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {files.length === 0 && !isUploading && (
          <div className="text-center p-3 text-xs text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-md">
            No files in context. Upload some documents to use RAG.
          </div>
        )}
      </div>
    </div>
  );
};
