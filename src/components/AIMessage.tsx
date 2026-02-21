import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface AIMessageProps {
  content: string;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0 leading-snug">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-gray-900 mt-3 mb-1.5 first:mt-0 leading-snug">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[15px] leading-[1.7] text-gray-800 my-2 first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 space-y-1 pl-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 space-y-1 pl-0 list-none counter-reset-item">{children}</ol>
  ),
  li: ({ children, ...props }) => {
    const isOrdered = props.node?.parent?.type === 'element' && 
      (props.node?.parent as { tagName?: string })?.tagName === 'ol';
    return (
      <li className={`flex gap-2 text-[15px] leading-[1.7] text-gray-800 ${isOrdered ? 'items-start' : 'items-start'}`}>
        <span className={`flex-shrink-0 mt-[3px] ${isOrdered ? 'text-purple-600 font-semibold text-sm min-w-[1.2rem]' : 'text-purple-500'}`}>
          {isOrdered ? '→' : '•'}
        </span>
        <span>{children}</span>
      </li>
    );
  },
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-700">{children}</em>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block bg-gray-900 text-green-400 text-[13px] font-mono leading-relaxed p-3 rounded-lg my-2 overflow-x-auto whitespace-pre">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-purple-50 text-purple-700 text-[13px] font-mono px-1.5 py-0.5 rounded">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 rounded-xl overflow-hidden">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-purple-300 bg-purple-50 pl-4 pr-3 py-2 my-2 rounded-r-lg text-gray-700 text-[15px] leading-[1.7]">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="border-none border-t border-gray-200 my-3" />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-purple-50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 text-xs font-semibold text-purple-700 border-b border-purple-200">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-[14px] text-gray-700 border-b border-gray-100">{children}</td>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline underline-offset-2 hover:text-purple-800">
      {children}
    </a>
  ),
};

const AIMessage = ({ content }: AIMessageProps) => {
  return (
    <div className="min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default AIMessage;
