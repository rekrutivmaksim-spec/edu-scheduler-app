import AiText from '@/components/AiText';

interface AIMessageProps {
  content: string;
}

const AIMessage = ({ content }: AIMessageProps) => {
  return <AiText text={content} />;
};

export default AIMessage;
