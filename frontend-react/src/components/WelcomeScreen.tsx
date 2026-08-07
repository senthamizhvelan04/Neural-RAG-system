import React from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Brain, Sparkles, FileText, Search, Code } from 'lucide-react';
import { WELCOME_PROMPTS } from '../lib/constants';

interface WelcomeScreenProps {
  onSend: (msg: string) => void;
}

const ICONS = [Sparkles, FileText, Search, Code];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSend }) => {
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col items-center min-h-full w-full max-w-4xl mx-auto px-4 py-12">
      
      <div className="my-auto flex flex-col items-center w-full">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-10 text-center"
        >
          <div className="w-20 h-20 bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-2xl flex items-center justify-center mb-6 shadow-sm relative overflow-hidden">
            <Brain size={40} className="relative z-10" />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }} 
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-tr from-[var(--color-accent)]/20 to-transparent z-0"
            />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-[var(--color-text)]">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-accent)] to-purple-500">NeuralRAG</span>
          </h1>
          <p className="text-[var(--color-text-secondary)] max-w-lg text-sm md:text-base">
            A personal project exploring RAG pipelines and agentic tool-calling.
          </p>
        </motion.div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl"
        >
          {WELCOME_PROMPTS.map((prompt, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <motion.button
                key={i}
                variants={item}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSend(prompt.text)}
                className="flex flex-col items-start p-4 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-xl text-left transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2 text-[var(--color-accent)]">
                  <Icon size={18} />
                  <span className="font-medium text-sm text-[var(--color-text)]">{prompt.title}</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {prompt.text}
                </p>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 pt-8 flex flex-col items-center gap-4 w-full border-t border-[var(--color-border)]"
      >
        <div className="flex items-center justify-center flex-wrap gap-2 text-xs font-mono text-[var(--color-text-muted)]">
          <span className="px-2 py-1 rounded-md bg-[var(--color-surface-alt)] border border-[var(--color-border)]">React 18</span>
          <span className="px-2 py-1 rounded-md bg-[var(--color-surface-alt)] border border-[var(--color-border)]">Flask</span>
          <span className="px-2 py-1 rounded-md bg-[var(--color-surface-alt)] border border-[var(--color-border)]">LangChain</span>
          <span className="px-2 py-1 rounded-md bg-[var(--color-surface-alt)] border border-[var(--color-border)]">ChromaDB</span>
        </div>
      </motion.div>
    </div>
  );
};
