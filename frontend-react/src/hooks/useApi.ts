import { useState, useEffect, useCallback } from 'react';
import type { Provider } from '../lib/constants';

export type ModelInfo = { id: string; name: string; available: boolean };
export type Settings = {
  web_search: boolean;
  system_control: boolean;
  mysql_enabled: boolean;
};
export type KeyPoolInfo = {
  total: number;
  active_index: number;
  keys_masked: string[];
};
export type KeysState = Record<string, KeyPoolInfo>;

export const useApi = () => {
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState('local');
  const [settings, setSettings] = useState<Settings>({
    web_search: false,
    system_control: true,
    mysql_enabled: true,
  });
  const [keys, setKeys] = useState<KeysState>({});
  const [isUploading, setIsUploading] = useState(false);

  // Initial data fetch
  useEffect(() => {
    const load = async () => {
      try {
        const [filesRes, modelsRes, keysRes] = await Promise.all([
          fetch('/api/files'),
          fetch('/api/models'),
          fetch('/api/keys'),
        ]);
        if (filesRes.ok) { const d = await filesRes.json(); setSavedFiles(d.files || []); }
        if (modelsRes.ok) { const d = await modelsRes.json(); setModels(d.models || []); setActiveModel(d.active || 'local'); }
        if (keysRes.ok) { const d = await keysRes.json(); setKeys(d || {}); }
      } catch { /* backend offline */ }
    };
    load();
  }, []);

  const updateSetting = useCallback(async (key: keyof Settings, val: boolean) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: val }),
      });
    } catch { /* silent */ }
  }, []);

  const changeModel = useCallback(async (id: string) => {
    setActiveModel(id);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: id }),
      });
    } catch { /* silent */ }
  }, []);

  const uploadFiles = useCallback(async (fileList: FileList) => {
    if (fileList.length === 0) return;
    setIsUploading(true);
    const fd = new FormData();
    for (let i = 0; i < fileList.length; i++) fd.append('files', fileList[i]);
    try {
      await fetch('/api/upload', { method: 'POST', body: fd });
      const res = await fetch('/api/files');
      if (res.ok) { const d = await res.json(); setSavedFiles(d.files || []); }
    } catch { /* silent */ }
    setIsUploading(false);
  }, []);

  const deleteFile = useCallback(async (name: string) => {
    if (!confirm(`Remove "${name}" from the knowledge base?`)) return;
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.ok) setSavedFiles(prev => prev.filter(f => f !== name));
    } catch { /* silent */ }
  }, []);

  const addKey = useCallback(async (provider: Provider, key: string) => {
    if (!key.trim()) return;
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: key.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setKeys(d.status);
        // Refresh models availability
        const modelsRes = await fetch('/api/models');
        if (modelsRes.ok) { const m = await modelsRes.json(); setModels(m.models || []); }
      }
    } catch { /* silent */ }
  }, []);

  const setActiveKey = useCallback(async (provider: string, index: number) => {
    try {
      const res = await fetch('/api/keys/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, index }),
      });
      if (res.ok) { const d = await res.json(); setKeys(d.status); }
    } catch { /* silent */ }
  }, []);

  return {
    savedFiles, models, activeModel, settings, keys, isUploading,
    updateSetting, changeModel, uploadFiles, deleteFile, addKey, setActiveKey,
  };
};
