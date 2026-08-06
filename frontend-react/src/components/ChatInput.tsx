import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (msg: string) => void;
  isProcessing: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isProcessing }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !isProcessing) {
      onSend(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-4 pb-6 pt-2">
      <div className="relative flex items-end bg-[var(--color-surface)]/80 backdrop-blur-md border border-[var(--color-border-strong)] rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-[var(--color-accent)] focus-within:border-[var(--color-accent)] transition-all overflow-hidden">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask NeuralRAG anything..."
          className="w-full max-h-[150px] min-h-[56px] py-4 pl-4 pr-12 bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] resize-none focus:outline-none custom-scrollbar"
          rows={1}
          disabled={isProcessing}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          className={`absolute right-2 bottom-2 p-2.5 rounded-xl flex items-center justify-center transition-all ${
            input.trim() && !isProcessing
              ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 shadow-sm'
              : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)]'
          }`}
        >
          {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
      <div className="text-center mt-2">
        <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
          Press <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-alt)] border border-[var(--color-border)]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-alt)] border border-[var(--color-border)]">Shift + Enter</kbd> for new line
        </span>
      </div>
    </div>
  );
};
