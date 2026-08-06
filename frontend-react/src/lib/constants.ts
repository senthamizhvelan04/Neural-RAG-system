export const MODEL_NAMES: Record<string, string> = {
  local: 'LM Studio (Local)',
  groq: 'Groq (Llama 3.3)',
  gemini: 'Gemini Flash (Latest)',
  openrouter: 'OpenRouter',
};

export const PROVIDERS = ['gemini', 'groq', 'openrouter'] as const;
export type Provider = typeof PROVIDERS[number];

export const WELCOME_PROMPTS = [
  { icon: 'Database', text: 'Query the database for top employees' },
  { icon: 'Search', text: 'Search the web for latest AI news' },
  { icon: 'ImageIcon', text: 'Generate a picture of a sunset' },
  { icon: 'FileText', text: 'Summarize uploaded documents' },
];

export const TOOL_CONFIG = [
  { key: 'web_search', label: 'Web Search', icon: 'Search' },
  { key: 'system_control', label: 'System Control', icon: 'Monitor' },
  { key: 'mysql_enabled', label: 'MySQL Access', icon: 'Database' },
  { key: 'image_gen_enabled', label: 'Image & Charts', icon: 'ImageIcon' },
] as const;
