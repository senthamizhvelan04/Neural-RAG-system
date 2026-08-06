import React, { useState } from 'react';
import { Key, Plus, Check } from 'lucide-react';
import type { KeysState } from '../hooks/useApi';
import type { Provider } from '../lib/constants';

interface KeyManagerProps {
  keys: KeysState;
  onAddKey: (provider: Provider, key: string) => void;
  onSetActive: (provider: string, index: number) => void;
}

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'groq', label: 'Groq' },
  { id: 'openrouter', label: 'OpenRouter' },
];

export const KeyManager: React.FC<KeyManagerProps> = ({ keys, onAddKey, onSetActive }) => {
  const [provider, setProvider] = useState<Provider>('gemini');
  const [keyValue, setKeyValue] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyValue.trim()) {
      onAddKey(provider, keyValue.trim());
      setKeyValue('');
    }
  };

  const currentPool = keys[provider] || { keys_masked: [], active_index: -1, total: 0 };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
        API Keys
      </h3>
      
      {/* Provider Tabs */}
      <div className="flex p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              provider === p.id 
                ? 'bg-[var(--color-surface-alt)] text-[var(--color-text)] shadow-sm border border-[var(--color-border)]' 
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Add Key Form */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[var(--color-text-muted)]">
            <Key size={14} />
          </div>
          <input
            type="password"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder={`Add ${PROVIDERS.find(p => p.id === provider)?.label} key...`}
            className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] text-[var(--color-text)]"
          />
        </div>
        <button
          type="submit"
          disabled={!keyValue.trim()}
          className="p-2 bg-[var(--color-accent)] text-white rounded-lg disabled:opacity-50 hover:bg-[var(--color-accent)]/90 transition-colors"
        >
          <Plus size={16} />
        </button>
      </form>

      {/* Key List */}
      <div className="flex flex-col gap-2">
        {currentPool.keys_masked && currentPool.keys_masked.length > 0 ? (
          currentPool.keys_masked.map((k: string, idx: number) => {
            const isActive = idx + 1 === currentPool.active_index;
            return (
              <div
                key={idx}
                onClick={() => onSetActive(provider, idx + 1)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                  isActive 
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]' 
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[var(--color-accent)]' : 'bg-transparent border border-[var(--color-border-strong)]'}`} />
                  <span className="font-mono text-xs truncate">{k}</span>
                </div>
                {isActive && <Check size={14} />}
              </div>
            );
          })
        ) : (
          <div className="text-center p-3 text-xs text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-md">
            No keys added for {PROVIDERS.find(p => p.id === provider)?.label}.
          </div>
        )}
      </div>
    </div>
  );
};
