import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface AutoRenewInfo {
  auto_renew?: boolean;
  has_card?: boolean;
  card_last4?: string;
  next_charge_date?: string;
  next_charge_amount?: number;
}

interface Props {
  isPremium: boolean;
  isTrial: boolean;
  expiresAt?: string;
  trialEndsAt?: string;
  autoRenewInfo: AutoRenewInfo | null;
  togglingAutoRenew: boolean;
  onToggleAutoRenew: () => void;
}

const SubscriptionStatus = ({
  isPremium,
  isTrial,
  expiresAt,
  trialEndsAt,
  autoRenewInfo,
  togglingAutoRenew,
  onToggleAutoRenew,
}: Props) => {
  return (
    <>
      {!isPremium && isTrial && trialEndsAt && (
        <Card className="p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Icon name="Gift" size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-800">Пробный период активен</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                До {new Date(trialEndsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5 flex-shrink-0">7 дней</Badge>
          </div>
        </Card>
      )}

      {isPremium && expiresAt && (
        <Card className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-green-300">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Icon name="Crown" size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-800">Premium активна</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                До {new Date(expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <Badge className="bg-green-500 text-white text-xs px-2 py-0.5 flex-shrink-0">Активна</Badge>
          </div>
        </Card>
      )}

      {isPremium && autoRenewInfo && (
        <Card className="p-4 sm:p-5 bg-white border-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name="RefreshCw" size={20} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Автопродление</h3>
                {autoRenewInfo.has_card && autoRenewInfo.card_last4 ? (
                  <p className="text-xs text-gray-500">Карта •••• {autoRenewInfo.card_last4}</p>
                ) : (
                  <p className="text-xs text-gray-500">Карта будет привязана при следующей оплате</p>
                )}
              </div>
            </div>
            <button
              onClick={onToggleAutoRenew}
              disabled={togglingAutoRenew}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                autoRenewInfo.auto_renew ? 'bg-purple-600' : 'bg-gray-300'
              } ${togglingAutoRenew ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  autoRenewInfo.auto_renew ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {autoRenewInfo.auto_renew && autoRenewInfo.next_charge_date && autoRenewInfo.next_charge_amount && (
            <p className="text-xs text-gray-400 mt-2 ml-13">
              Следующее списание {autoRenewInfo.next_charge_amount} ₽ — {new Date(autoRenewInfo.next_charge_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </p>
          )}
        </Card>
      )}
    </>
  );
};

export default SubscriptionStatus;
