import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface AiTextProps {
  text: string;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'info';
}

const variantStyles = {
  default: {
    p: 'text-gray-700',
    strong: 'text-gray-900',
    heading: 'text-gray-900',
    bullet: 'from-indigo-400 to-purple-400',
    numBg: 'from-indigo-50 to-purple-50',
    numText: 'text-indigo-600',
    accent: 'border-indigo-400',
    quoteBg: 'bg-indigo-50/60',
    quoteText: 'text-indigo-800',
    codeBg: 'bg-indigo-50',
    codeText: 'text-indigo-700',
  },
  success: {
    p: 'text-green-800',
    strong: 'text-green-900',
    heading: 'text-green-900',
    bullet: 'from-green-400 to-emerald-400',
    numBg: 'from-green-50 to-emerald-50',
    numText: 'text-green-700',
    accent: 'border-green-400',
    quoteBg: 'bg-green-50/60',
    quoteText: 'text-green-800',
    codeBg: 'bg-green-50',
    codeText: 'text-green-800',
  },
  warning: {
    p: 'text-amber-800',
    strong: 'text-amber-900',
    heading: 'text-amber-900',
    bullet: 'from-amber-400 to-orange-400',
    numBg: 'from-amber-50 to-orange-50',
    numText: 'text-amber-700',
    accent: 'border-amber-400',
    quoteBg: 'bg-amber-50/60',
    quoteText: 'text-amber-800',
    codeBg: 'bg-amber-50',
    codeText: 'text-amber-800',
  },
  info: {
    p: 'text-indigo-800',
    strong: 'text-indigo-900',
    heading: 'text-indigo-900',
    bullet: 'from-blue-400 to-indigo-400',
    numBg: 'from-blue-50 to-indigo-50',
    numText: 'text-blue-700',
    accent: 'border-blue-400',
    quoteBg: 'bg-blue-50/60',
    quoteText: 'text-blue-800',
    codeBg: 'bg-blue-50',
    codeText: 'text-blue-800',
  },
};

function makeComponents(s: typeof variantStyles.default): Components {
  return {
    h1: ({ children }) => (
      <h1 className={`text-[17px] font-extrabold ${s.heading} mt-4 mb-2 first:mt-0 flex items-center gap-2`}>
        <span className={`w-1 h-5 bg-gradient-to-b ${s.bullet} rounded-full flex-shrink-0`} />
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={`text-[16px] font-bold ${s.heading} mt-3.5 mb-1.5 first:mt-0 flex items-center gap-2`}>
        <span className={`w-1 h-4 bg-gradient-to-b ${s.bullet} rounded-full flex-shrink-0`} />
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={`text-[15px] font-bold ${s.heading} mt-3 mb-1 first:mt-0`}>{children}</h3>
    ),
    p: ({ children }) => (
      <p className={`text-[15px] leading-[1.8] ${s.p} my-2 first:mt-0 last:mb-0`}>{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-2.5 space-y-1.5 pl-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2.5 space-y-2 pl-0 list-none">{children}</ol>
    ),
    li: ({ children, ...props }) => {
      const parent = props.node?.parent;
      const isOrdered = parent?.type === 'element' && (parent as { tagName?: string })?.tagName === 'ol';
      const idx = props.node?.position?.start?.line;
      if (isOrdered) {
        const siblings = parent?.children?.filter(
          (c: { type: string }) => c.type === 'element'
        );
        const num = siblings ? siblings.indexOf(props.node as never) + 1 : (idx || 1);
        return (
          <li className="flex items-start gap-2.5">
            <span className={`flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br ${s.numBg} flex items-center justify-center text-[11px] font-extrabold ${s.numText} mt-0.5`}>
              {num}
            </span>
            <span className={`text-[15px] leading-[1.7] ${s.p} flex-1`}>{children}</span>
          </li>
        );
      }
      return (
        <li className="flex items-start gap-2.5 pl-0.5">
          <span className={`flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-br ${s.bullet} mt-[9px]`} />
          <span className={`text-[15px] leading-[1.7] ${s.p} flex-1`}>{children}</span>
        </li>
      );
    },
    strong: ({ children }) => (
      <strong className={`font-bold ${s.strong}`}>{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic opacity-85">{children}</em>
    ),
    code: ({ children, className: cn }) => {
      const isBlock = cn?.includes('language-');
      if (isBlock) {
        return (
          <code className="block bg-gray-900 text-green-400 text-[13px] font-mono leading-relaxed p-3.5 rounded-xl my-2.5 overflow-x-auto whitespace-pre">
            {children}
          </code>
        );
      }
      return (
        <code className={`${s.codeBg} ${s.codeText} text-[13px] font-mono px-1.5 py-0.5 rounded-md`}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-3 rounded-xl overflow-hidden">{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className={`border-l-[3px] ${s.accent} ${s.quoteBg} pl-4 pr-3 py-2 my-2.5 rounded-r-xl ${s.quoteText} text-[15px] leading-[1.7]`}>
        {children}
      </blockquote>
    ),
    hr: () => (
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-3 rounded-xl border border-gray-200">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-50">{children}</thead>
    ),
    th: ({ children }) => (
      <th className={`text-left px-3 py-2.5 text-xs font-bold ${s.heading} border-b border-gray-200`}>{children}</th>
    ),
    td: ({ children }) => (
      <td className={`px-3 py-2 text-[14px] ${s.p} border-b border-gray-50`}>{children}</td>
    ),
    a: ({ children, href }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 transition-colors">
        {children}
      </a>
    ),
  };
}

const cachedComponents: Record<string, Components> = {};
function getComponents(variant: string) {
  if (!cachedComponents[variant]) {
    cachedComponents[variant] = makeComponents(variantStyles[variant as keyof typeof variantStyles] || variantStyles.default);
  }
  return cachedComponents[variant];
}

export default function AiText({ text, className = '', variant = 'default' }: AiTextProps) {
  if (!text) return null;

  const components = getComponents(variant);

  return (
    <div className={`min-w-0 ai-text ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
