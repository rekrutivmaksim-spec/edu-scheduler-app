import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useTheme } from '@/lib/theme-context';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="hover:bg-purple-100/50 dark:hover:bg-purple-900/50 rounded-xl h-8 w-8 sm:h-10 sm:w-10"
      title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
    >
      {theme === 'light' ? (
        <Icon name="Moon" size={18} className="text-purple-600 dark:text-purple-400 sm:w-5 sm:h-5" />
      ) : (
        <Icon name="Sun" size={18} className="text-purple-400 sm:w-5 sm:h-5" />
      )}
    </Button>
  );
};

export default ThemeToggle;
