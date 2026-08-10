export const MODEL_NAMES: Record<string, string> = {
  local: 'LM Studio (Local)',
  groq: 'Groq (Llama 3.3)',
  gemini: 'Gemini Flash (Latest)',
  openrouter: 'OpenRouter',
};

export const PROVIDERS = ['gemini', 'groq', 'openrouter'] as const;
export type Provider = typeof PROVIDERS[number];

export const WELCOME_PROMPTS = [
  { icon: 'Database', title: 'Data Query', text: 'Query the database for top employees' },
  { icon: 'Search', title: 'Web Search', text: 'Search the web for latest AI news' },
  { icon: 'FileText', title: 'Analyze Docs', text: 'Analyze and summarize my uploaded documents' },
  { icon: 'Code', title: 'Visualize Data', text: 'Create a chart from uploaded data' },
];

export const TOOL_CONFIG = [
  { key: 'web_search', label: 'Web Search', icon: 'Search' },
  { key: 'system_control', label: 'System Control', icon: 'Monitor' },
  { key: 'mysql_enabled', label: 'MySQL Access', icon: 'Database' },
] as const;
