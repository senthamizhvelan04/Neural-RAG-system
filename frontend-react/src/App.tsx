import { useState, useEffect, useCallback } from 'react';
import 'highlight.js/styles/github-dark.css';

import { useChat } from './hooks/useChat';
import { useApi } from './hooks/useApi';
import { Sidebar } from './components/Sidebar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import type { Settings } from './hooks/useApi';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false); // Force light mode default

  const { messages, isProcessing, scrollRef, sendMessage, clearMessages } = useChat();
  const {
    savedFiles, models, activeModel, settings, keys, isUploading,
    updateSetting, changeModel, uploadFiles, deleteFile, addKey, setActiveKey,
  } = useApi();

  // Apply dark mode class on mount and toggle
  useEffect(() => {
    localStorage.setItem('theme', 'light'); // Force clear old preference
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const handleSend = useCallback((msg: string) => {
    sendMessage(msg);
    // Close sidebar on mobile after sending
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [sendMessage]);

  // Build tools record for Sidebar
  const toolsEnabled: Record<string, boolean> = {
    web_search: settings.web_search,
    system_control: settings.system_control,
    mysql_enabled: settings.mysql_enabled,
    image_gen_enabled: settings.image_gen_enabled,
  };

  const handleToggleTool = useCallback((tool: string) => {
    updateSetting(tool as keyof Settings, !settings[tool as keyof Settings]);
  }, [settings, updateSetting]);

  return (
    <div className="flex h-screen w-full bg-[var(--color-bg)] transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        models={models}
        activeModel={activeModel}
        onSelectModel={changeModel}
        files={savedFiles}
        isUploading={isUploading}
        onUpload={uploadFiles}
        onDeleteFile={deleteFile}
        keys={keys}
        onAddKey={addKey}
        onSetActiveKey={setActiveKey}
        toolsEnabled={toolsEnabled}
        onToggleTool={handleToggleTool}
        clearMessages={clearMessages}
        toggleDarkMode={toggleDarkMode}
        isDarkMode={isDarkMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Top bar with menu button */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] rounded-lg transition-colors lg:hidden"
            aria-label="Open sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="hidden lg:block" />
          <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface)] px-3 py-1 rounded-full border border-[var(--color-border)]">
            {models.find(m => m.id === activeModel)?.name || 'LM Studio (Local)'}
          </span>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6 pb-36"
        >
          {messages.length === 0 ? (
            <WelcomeScreen onSend={handleSend} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map(m => (
                (m.role === 'assistant' && m.content === '' && isProcessing) ? null : <MessageBubble key={m.id} message={m} />
              ))}

              {/* Typing indicator */}
              {isProcessing && messages[messages.length - 1]?.content === '' && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                    <div className="w-4 h-4 rounded-full bg-[var(--color-accent-soft)]" />
                  </div>
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <span className="text-xs text-[var(--color-text-muted)] ml-2">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput onSend={handleSend} isProcessing={isProcessing} />
      </main>
    </div>
  );
}
