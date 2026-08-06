import { useState, useRef, useCallback } from 'react';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Line buffer for robust SSE parsing
  const bufferRef = useRef('');

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || isProcessing) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg };
    const replyId = (Date.now() + 1).toString();
    
    setMessages(prev => [...prev, userMsg, { id: replyId, role: 'assistant', content: '' }]);
    setIsProcessing(true);
    scrollToBottom();
    bufferRef.current = '';

    try {
      const res = await fetch('/api/chat_stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('No stream reader');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bufferRef.current += decoder.decode(value, { stream: true });
        const lines = bufferRef.current.split('\n');
        // Keep the last incomplete line in the buffer
        bufferRef.current = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]' || !dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.token !== undefined) {
              setMessages(prev =>
                prev.map(m => m.id === replyId ? { ...m, content: m.content + data.token } : m)
              );
            } else if (data.error) {
              setMessages(prev =>
                prev.map(m => m.id === replyId ? { ...m, content: m.content + `\n\n**Error**: ${data.error}` } : m)
              );
            }
          } catch { /* partial JSON, skip */ }
        }
        scrollToBottom();
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === replyId ? { ...m, content: '⚠️ Connection error. Please check the backend server.' } : m)
      );
    } finally {
      setIsProcessing(false);
      scrollToBottom();
    }
  }, [isProcessing, scrollToBottom]);

  const clearMessages = useCallback(async () => {
    if (!confirm("Clear the entire conversation? This can't be undone.")) return;
    try {
      await fetch('/api/clear', { method: 'POST' });
      setMessages([]);
    } catch { /* silent */ }
  }, []);

  return { messages, isProcessing, scrollRef, sendMessage, clearMessages };
};
