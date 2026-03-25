import { useMemo } from 'react';

interface AiTextProps {
  text: string;
  className?: string;
}

interface TextBlock {
  type: 'heading' | 'bullet' | 'numbered' | 'highlight' | 'paragraph' | 'divider';
  content: string;
  number?: number;
}

function parseBlocks(text: string): TextBlock[] {
  const lines = text.split('\n');
  const blocks: TextBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line === '---' || line === '***') {
      blocks.push({ type: 'divider', content: '' });
      continue;
    }

    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', content: headingMatch[1] });
      continue;
    }

    const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numberedMatch) {
      blocks.push({ type: 'numbered', content: numberedMatch[2], number: parseInt(numberedMatch[1]) });
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      blocks.push({ type: 'bullet', content: line.slice(2) });
      continue;
    }

    if ((line.startsWith('**') && line.endsWith('**')) || (line.startsWith('«') && line.endsWith('»'))) {
      blocks.push({ type: 'highlight', content: line.replace(/^\*\*|\*\*$/g, '') });
      continue;
    }

    blocks.push({ type: 'paragraph', content: line });
  }

  return blocks;
}

function renderInline(text: string) {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`|_(.+?)_/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={key++} className="font-bold text-gray-900">{match[1]}</strong>);
    } else if (match[2]) {
      parts.push(<code key={key++} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md text-[13px] font-mono">{match[2]}</code>);
    } else if (match[3]) {
      parts.push(<em key={key++} className="italic text-gray-600">{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function AiText({ text, className = '' }: AiTextProps) {
  const blocks = useMemo(() => parseBlocks(text), [text]);

  if (blocks.length <= 1 && blocks[0]?.type === 'paragraph') {
    return (
      <p className={`text-[14.5px] leading-[1.75] text-gray-700 ${className}`}>
        {renderInline(blocks[0].content)}
      </p>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={i} className="text-[15px] font-extrabold text-gray-900 mt-1 flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full flex-shrink-0" />
                {renderInline(block.content)}
              </h3>
            );
          case 'numbered':
            return (
              <div key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-[11px] font-extrabold text-indigo-600 mt-0.5">
                  {block.number}
                </span>
                <p className="text-[14px] leading-[1.7] text-gray-700 flex-1">
                  {renderInline(block.content)}
                </p>
              </div>
            );
          case 'bullet':
            return (
              <div key={i} className="flex items-start gap-2.5 pl-1">
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 mt-2" />
                <p className="text-[14px] leading-[1.7] text-gray-700 flex-1">
                  {renderInline(block.content)}
                </p>
              </div>
            );
          case 'highlight':
            return (
              <div key={i} className="bg-gradient-to-r from-indigo-50 to-purple-50 border-l-[3px] border-indigo-400 rounded-r-xl px-3.5 py-2.5">
                <p className="text-[14px] font-semibold text-indigo-800 leading-[1.6]">
                  {renderInline(block.content)}
                </p>
              </div>
            );
          case 'divider':
            return (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              </div>
            );
          case 'paragraph':
          default:
            return (
              <p key={i} className="text-[14.5px] leading-[1.75] text-gray-700">
                {renderInline(block.content)}
              </p>
            );
        }
      })}
    </div>
  );
}
