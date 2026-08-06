import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

export const parseMarkdown = (content: string): string => {
  const cleaned = content.trim()
    .replace(/:::IMAGE:::(.*?):::END:::/g, '')
    .replace(/:::CHART:::(.*?):::END:::/g, '');
  return marked.parse(cleaned) as string;
};

export const extractMedia = (content: string) => {
  const images: string[] = [];
  const charts: string[] = [];
  content.replace(/:::IMAGE:::(.*?):::END:::/g, (_, url) => { images.push(url.trim()); return ''; });
  content.replace(/:::CHART:::(.*?):::END:::/g, (_, url) => { charts.push(url.trim()); return ''; });
  return { images, charts };
};

export { marked };
