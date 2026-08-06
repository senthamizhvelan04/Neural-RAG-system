import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Plus, X, Brain, Wrench } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { FileManager } from './FileManager';
import { KeyManager } from './KeyManager';
import type { ModelInfo, KeysState } from '../hooks/useApi';
import type { Provider } from '../lib/constants';

interface SidebarProps {
  models: ModelInfo[];
  activeModel: string;
  onSelectModel: (id: string) => void;
  files: string[];
  isUploading: boolean;
  onUpload: (files: FileList) => void;
  onDeleteFile: (name: string) => void;
  keys: KeysState;
  onAddKey: (provider: Provider, key: string) => void;
  onSetActiveKey: (provider: string, index: number) => void;
  toolsEnabled: Record<string, boolean>;
  onToggleTool: (tool: string) => void;
  clearMessages: () => void;
  toggleDarkMode: () => void;
  isDarkMode: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  models, activeModel, onSelectModel,
  files, isUploading, onUpload, onDeleteFile,
  keys, onAddKey, onSetActiveKey,
  toolsEnabled, onToggleTool,
  clearMessages, toggleDarkMode, isDarkMode,
  sidebarOpen, setSidebarOpen
}) => {
  const sidebarContent = (
    <div className="h-full flex flex-col bg-[var(--color-bg)] border-r border-[var(--color-border)] w-72 lg:w-80 shadow-xl lg:shadow-none">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[var(--color-accent)] text-white rounded-lg">
            <Brain size={20} />
          </div>
          <h1 className="font-bold text-[var(--color-text)] tracking-tight">NeuralRAG</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleDarkMode} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md hover:bg-[var(--color-surface)] transition-colors">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setSidebarOpen(false)} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md hover:bg-[var(--color-surface)] transition-colors lg:hidden">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-[var(--color-border)]">
        <button 
          onClick={clearMessages}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg transition-colors font-medium text-sm"
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8 custom-scrollbar">
        <ModelSelector models={models} activeModel={activeModel} onSelect={onSelectModel} />
        
        <FileManager files={files} isUploading={isUploading} onUpload={onUpload} onDelete={onDeleteFile} />
        
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1">
            <Wrench size={12} /> Tools
          </h3>
          <div className="flex flex-col gap-2">
            {Object.entries(toolsEnabled).map(([tool, enabled]) => (
              <label key={tool} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer hover:border-[var(--color-border-strong)] transition-colors">
                <span className="text-sm text-[var(--color-text)] capitalize">{tool}</span>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={enabled} onChange={() => onToggleTool(tool)} />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-accent)]"></div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <KeyManager keys={keys} onAddKey={onAddKey} onSetActive={onSetActiveKey} />
      </div>


    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform lg:transform-none lg:static transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {sidebarContent}
      </div>
    </>
  );
};
