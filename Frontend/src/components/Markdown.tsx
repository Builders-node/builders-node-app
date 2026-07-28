import type { ReactNode } from 'react';

// Minimal, safe markdown-lite renderer (React elements only — no HTML injection).
// Supports: ## / ### headings, "- " bullet lists, blank-line paragraphs, plus
// inline **bold** and [text](https://url) links. Anything else renders as text.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenize on **bold** and [text](url); everything else is plain text.
  const regex = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{match[2]}</strong>);
    } else if (match[4] !== undefined && match[5] !== undefined) {
      nodes.push(
        <a key={`${keyPrefix}-a${i}`} href={match[5]} target="_blank" rel="noopener noreferrer">
          {match[4]}
        </a>,
      );
    }
    last = regex.lastIndex;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={`p${blocks.length}`}>{renderInline(para.join(' '), `p${blocks.length}`)}</p>);
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u${blocks.length}`}>
          {bullets.map((b, idx) => (
            <li key={idx}>{renderInline(b, `u${blocks.length}-${idx}`)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flushPara();
      flushBullets();
    } else if (line.startsWith('### ')) {
      flushPara();
      flushBullets();
      blocks.push(<h4 key={`h${blocks.length}`}>{renderInline(line.slice(4), `h${blocks.length}`)}</h4>);
    } else if (line.startsWith('## ')) {
      flushPara();
      flushBullets();
      blocks.push(<h3 key={`h${blocks.length}`}>{renderInline(line.slice(3), `h${blocks.length}`)}</h3>);
    } else if (line.startsWith('- ')) {
      flushPara();
      bullets.push(line.slice(2));
    } else {
      flushBullets();
      para.push(line);
    }
  }
  flushPara();
  flushBullets();

  return <div className="markdown-body">{blocks}</div>;
}
