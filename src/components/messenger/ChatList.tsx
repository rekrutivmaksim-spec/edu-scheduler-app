import { chats, contacts } from './data';

interface ChatListProps {
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
}

export default function ChatList({ activeChatId, onChatSelect }: ChatListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-white/5">
        <h2 className="font-display text-lg font-semibold gradient-text tracking-wide">ЧАТЫ</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{chats.filter(c => c.unread > 0).length} непрочитанных</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {chats.map((chat, i) => {
          const contact = contacts.find(c => c.id === chat.contactId);
          if (!contact) return null;
          const lastMsg = chat.messages[chat.messages.length - 1];
          const isActive = activeChatId === chat.id;

          return (
            <button
              key={chat.id}
              onClick={() => onChatSelect(chat.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 text-left group animate-slide-up ${
                isActive ? 'bg-white/6 border-r-2 border-[var(--neon-purple)]' : 'hover:bg-white/3'
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="relative flex-shrink-0">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl glass ${
                  isActive ? 'neon-glow' : ''
                }`}>
                  {contact.avatar}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                  contact.status === 'online' ? 'bg-[var(--neon-green)]' :
                  contact.status === 'busy' ? 'bg-red-500' :
                  contact.status === 'away' ? 'bg-yellow-400' : 'bg-gray-500'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-medium text-sm truncate ${isActive ? 'text-white' : 'text-foreground/90'}`}>
                    {contact.name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{lastMsg?.time}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {lastMsg?.senderId === 'me' ? <span className="text-[var(--neon-purple)]/70">Вы: </span> : null}
                    {lastMsg?.text}
                  </p>
                  {chat.unread > 0 && (
                    <span className="ml-2 flex-shrink-0 w-5 h-5 gradient-bg rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
