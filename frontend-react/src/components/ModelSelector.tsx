import React from 'react';
import { motion } from 'framer-motion';
import type { ModelInfo } from '../hooks/useApi';

interface ModelSelectorProps {
  models: ModelInfo[];
  activeModel: string;
  onSelect: (id: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ models, activeModel, onSelect }) => {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
        Language Model
      </h3>
      <div className="flex flex-col gap-2">
        {models.map((model) => {
          const isActive = activeModel === model.id;
          const isAvailable = model.available !== false;
          
          return (
            <motion.button
              key={model.id}
              whileHover={isAvailable ? { scale: 1.01 } : {}}
              whileTap={isAvailable ? { scale: 0.98 } : {}}
              onClick={() => isAvailable && onSelect(model.id)}
              disabled={!isAvailable}
              className={`
                relative flex items-center justify-between p-3 rounded-lg border text-left transition-all
                ${isActive 
                  ? 'bg-[var(--color-surface-alt)] border-[var(--color-accent)] shadow-sm' 
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}
                ${!isAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-accent)] rounded-l-lg" />
              )}
              
              <div className="flex flex-col">
                <span className={`text-sm font-medium ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
                  {model.name}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isActive ? 'bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]' : 
                  isAvailable ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
