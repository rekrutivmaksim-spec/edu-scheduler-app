export interface Contact {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'away' | 'offline' | 'busy';
  lastSeen?: string;
  bio?: string;
  phone?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  read: boolean;
  type?: 'text' | 'call' | 'vcall';
}

export interface Chat {
  id: string;
  contactId: string;
  messages: Message[];
  unread: number;
  pinned?: boolean;
}

export interface Notification {
  id: string;
  type: 'message' | 'call' | 'contact' | 'system';
  title: string;
  text: string;
  time: string;
  read: boolean;
  avatar?: string;
}

export const contacts: Contact[] = [
  { id: 'u1', name: 'Алиса Морозова', avatar: '🌸', status: 'online', bio: 'Живу в моменте ✨', phone: '+7 999 123-45-67' },
  { id: 'u2', name: 'Макс Ветров', avatar: '🎮', status: 'busy', bio: 'Не беспокоить — гейминг', phone: '+7 999 234-56-78' },
  { id: 'u3', name: 'Саша Звёздная', avatar: '🚀', status: 'online', bio: 'Дизайнер / путешественник', phone: '+7 999 345-67-89' },
  { id: 'u4', name: 'Рита Огнева', avatar: '🔥', status: 'away', bio: 'Кофе и код', phone: '+7 999 456-78-90' },
  { id: 'u5', name: 'Дима Синий', avatar: '🌊', status: 'offline', lastSeen: '2 часа назад', phone: '+7 999 567-89-01' },
  { id: 'u6', name: 'Катя Лесная', avatar: '🌿', status: 'online', bio: 'Люблю природу и музыку', phone: '+7 999 678-90-12' },
  { id: 'u7', name: 'Игорь Стальной', avatar: '⚡', status: 'online', bio: 'Frontend dev', phone: '+7 999 789-01-23' },
  { id: 'u8', name: 'Оля Цветкова', avatar: '🌺', status: 'away', lastSeen: '15 мин назад', phone: '+7 999 890-12-34' },
];

export const chats: Chat[] = [
  {
    id: 'c1', contactId: 'u1', unread: 3, pinned: true,
    messages: [
      { id: 'm1', senderId: 'u1', text: 'Привет! Как дела? 😊', time: '10:24', read: true },
      { id: 'm2', senderId: 'me', text: 'Отлично, работаю над новым проектом!', time: '10:25', read: true },
      { id: 'm3', senderId: 'u1', text: 'Звучит круто! Расскажи подробнее', time: '10:26', read: true },
      { id: 'm4', senderId: 'me', text: 'Делаю мессенджер, очень интересно 🚀', time: '10:28', read: true },
      { id: 'm5', senderId: 'u1', text: 'Вау! Когда покажешь?', time: '10:29', read: false },
      { id: 'm6', senderId: 'u1', text: 'Жду с нетерпением!', time: '10:29', read: false },
      { id: 'm7', senderId: 'u1', text: 'Напиши когда будет готово 🌸', time: '10:30', read: false },
    ]
  },
  {
    id: 'c2', contactId: 'u3', unread: 1,
    messages: [
      { id: 'm1', senderId: 'u3', text: 'Привет! Видел мои новые скетчи?', time: '09:15', read: true },
      { id: 'm2', senderId: 'me', text: 'Да, они потрясающие!', time: '09:17', read: true },
      { id: 'm3', senderId: 'u3', text: 'Спасибо! Работаю над новой коллекцией 🎨', time: '09:18', read: false },
    ]
  },
  {
    id: 'c3', contactId: 'u2', unread: 0,
    messages: [
      { id: 'm1', senderId: 'me', text: 'Как прошла игра?', time: 'вчера', read: true },
      { id: 'm2', senderId: 'u2', text: 'Эпично! Наконец-то победил финального босса 🎮', time: 'вчера', read: true },
    ]
  },
  {
    id: 'c4', contactId: 'u4', unread: 0,
    messages: [
      { id: 'm1', senderId: 'u4', text: 'Кофе готов ☕', time: 'вчера', read: true },
      { id: 'm2', senderId: 'me', text: 'Бегу! 🏃', time: 'вчера', read: true },
    ]
  },
  {
    id: 'c5', contactId: 'u7', unread: 2,
    messages: [
      { id: 'm1', senderId: 'u7', text: 'Глянь этот баг в продакшне ⚡', time: '08:00', read: true },
      { id: 'm2', senderId: 'u7', text: 'Срочно нужна помощь!', time: '08:01', read: false },
      { id: 'm3', senderId: 'u7', text: 'Ты онлайн?', time: '08:05', read: false },
    ]
  },
];

export const notifications: Notification[] = [
  { id: 'n1', type: 'message', title: 'Алиса Морозова', text: 'Напиши когда будет готово 🌸', time: '10:30', read: false, avatar: '🌸' },
  { id: 'n2', type: 'call', title: 'Пропущенный звонок', text: 'Макс Ветров звонил вам', time: '09:45', read: false, avatar: '🎮' },
  { id: 'n3', type: 'contact', title: 'Новый контакт', text: 'Катя Лесная добавила вас', time: '09:00', read: false, avatar: '🌿' },
  { id: 'n4', type: 'message', title: 'Игорь Стальной', text: 'Ты онлайн?', time: '08:05', read: true, avatar: '⚡' },
  { id: 'n5', type: 'system', title: 'NeoChat', text: 'Добро пожаловать в мессенджер нового поколения!', time: 'вчера', read: true },
  { id: 'n6', type: 'call', title: 'Входящий видеозвонок', text: 'Саша Звёздная хочет пообщаться', time: 'вчера', read: true, avatar: '🚀' },
];

export const me: Contact = {
  id: 'me',
  name: 'Вы',
  avatar: '😎',
  status: 'online',
  bio: 'Пользователь NeoChat',
  phone: '+7 999 000-00-00',
};
