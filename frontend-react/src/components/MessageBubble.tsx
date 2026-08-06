import React from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { parseMarkdown, extractMedia } from '../lib/markdown';
import type { Message } from '../hooks/useChat';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message }) => {
  const isUser = message.role === 'user';
  
  const renderContent = () => {
    if (isUser) {
      return <div className="text-white whitespace-pre-wrap">{message.content}</div>;
    }

    const { images, charts } = extractMedia(message.content);
    const htmlContent = parseMarkdown(message.content);

    return (
      <div className="flex flex-col gap-3">
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((url, idx) => (
              <img key={idx} src={url} alt="Generated" className="rounded-lg shadow-sm max-w-sm max-h-64 object-contain" />
            ))}
          </div>
        )}
        {charts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {charts.map((url, idx) => (
              <img key={idx} src={url} alt="Chart" className="rounded-lg shadow-sm max-w-full max-h-64 object-contain" />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)] self-start mt-1">
            <Brain size={18} />
          </div>
        )}
        
        <div 
          className={`px-5 py-3.5 shadow-sm ${
            isUser 
              ? 'bg-[var(--color-user-bubble)] text-[var(--color-user-bubble-text)] rounded-2xl rounded-tr-sm' 
              : 'bg-[var(--color-bot-bubble)] text-[var(--color-bot-bubble-text)] border border-[var(--color-bot-bubble-border)] rounded-2xl rounded-tl-sm'
          }`}
        >
          {renderContent()}
        </div>
      </div>
    </motion.div>
  );
});

MessageBubble.displayName = 'MessageBubble';
