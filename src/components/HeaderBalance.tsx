import Icon from '@/components/ui/icon';
import { useBalance } from '@/context/BalanceContext';

export default function HeaderBalance() {
  const { balanceInfo } = useBalance();

  if (!balanceInfo) return null;

  if (balanceInfo.unlimited_access) {
    return (
      <div className="flex items-center gap-1.5 text-primary">
        <Icon name="Infinity" size={20} className="hidden lg:inline" />
        <Icon name="Infinity" size={18} className="lg:hidden" />
        <span className="text-sm font-medium hidden lg:inline">Безлимит</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Icon name="Wallet" size={20} className="hidden lg:inline text-muted-foreground" />
      <Icon name="Wallet" size={18} className="lg:hidden text-muted-foreground" />
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground hidden lg:inline">Баланс</span>
        <span className="text-sm font-medium">{balanceInfo.balance.toFixed(0)} ₽</span>
      </div>
    </div>
  );
}