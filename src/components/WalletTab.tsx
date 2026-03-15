import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useBalance } from "@/context/BalanceContext";
import { useSearchParams } from "react-router-dom";
import { GENERATION_COST, MIN_TOPUP } from "@/config/prices";
import { openPaymentUrl } from "@/lib/payment-utils";

const USER_BALANCE_API =
  "https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1";
const YOOKASSA_PAYMENT_API =
  "https://functions.poehali.dev/f7ad0852-ed82-4ae0-b6ee-c2629c1ac4bb";
const BALANCE_HISTORY_API =
  "https://functions.poehali.dev/3cbe003b-0f4c-4e91-894b-4e5170c468ad";

interface BalanceInfo {
  balance: number;
  free_tries_remaining: number;
  paid_tries_available: number;
  unlimited_access: boolean;
  can_generate: boolean;
}

interface BalanceTransaction {
  id: string;
  type: "deposit" | "charge" | "refund";
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  is_deleted: boolean;
}

export default function WalletTab() {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const [searchParams] = useSearchParams();
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<BalanceTransaction[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const transactionsPerPage = 50;

  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchBalanceHistory();
    }

    const payment = searchParams.get("payment");
    if (payment === "success") {
      toast.success("Платеж успешно обработан!");
      setTimeout(() => {
        fetchBalance();
        fetchBalanceHistory();
        refreshBalance();
      }, 1000);
    } else if (payment === "failed") {
      toast.error("Ошибка оплаты");
    }
  }, [user, searchParams, currentPage]);

  const fetchBalance = async () => {
    if (!user) return;

    try {
      const response = await fetch(USER_BALANCE_API, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setBalanceInfo(data);
      } else {
        toast.error("Ошибка загрузки баланса");
      }
    } catch (error) {
      toast.error("Ошибка соединения");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBalanceHistory = async () => {
    if (!user) return;

    try {
      const offset = (currentPage - 1) * transactionsPerPage;
      const response = await fetch(
        `${BALANCE_HISTORY_API}?user_id=${user.id}&limit=${transactionsPerPage}&offset=${offset}`,
      );

      if (response.ok) {
        const data = await response.json();
        setBalanceHistory(data.transactions || []);
        setTotalTransactions(data.total || data.transactions.length);
      }
    } catch {
      /* silent */
    }
  };

  const handleTopUp = async (amount: number) => {
    if (!user) return;

    setIsCreatingPayment(true);

    try {
      const response = await fetch(YOOKASSA_PAYMENT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id,
          amount,
        }),
      });

      const data = await response.json();

      if (response.ok && data.payment_url) {
        await openPaymentUrl(data.payment_url);
      } else {
        toast.error(data.error || "Ошибка создания платежа");
      }
    } catch (error) {
      toast.error("Ошибка соединения");
    } finally {
      setIsCreatingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader2" className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Wallet" size={24} />
              Баланс
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Сумма на счету
                </p>
                <p className="text-4xl font-light">
                  {balanceInfo?.balance.toFixed(2)} ₽
                </p>
              </div>

              {balanceInfo?.unlimited_access ? (
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-3 rounded-lg">
                  <Icon name="Infinity" size={20} />
                  <span className="font-medium">Безлимитный доступ</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Временно скрыто - бесплатные примерки пока не используются */}
                  {/* <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Бесплатных примерок:</span>
                    <span className="font-medium">{balanceInfo?.free_tries_remaining} / 3</span>
                  </div> */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Доступно примерок:
                    </span>
                    <span className="font-medium">
                      {balanceInfo?.paid_tries_available}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Стоимость: {GENERATION_COST}₽ за образ / шаг
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="CreditCard" size={24} />
              Пополнение
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Выберите сумму для пополнения баланса
            </p>
            <div className="space-y-3">
              {[MIN_TOPUP, 300, 500, 1500, 3000].map((amount) => (
                <Button
                  key={amount}
                  className="w-full justify-between"
                  variant="outline"
                  size="lg"
                  onClick={() => handleTopUp(amount)}
                  disabled={isCreatingPayment}
                >
                  <span>{amount.toLocaleString("ru-RU")} ₽</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.floor(amount / GENERATION_COST)} образ{Math.floor(amount / GENERATION_COST) === 1 ? "" : Math.floor(amount / GENERATION_COST) < 5 ? "а" : "ов"}
                  </span>
                </Button>
              ))}
            </div>
            {isCreatingPayment && (
              <div className="flex items-center justify-center mt-4">
                <Icon name="Loader2" className="animate-spin mr-2" size={16} />
                <span className="text-sm">Переход к оплате...</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Оплата через ЮКасса. Безопасная обработка платежей.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Receipt" size={24} />
            История операций
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balanceHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon
                name="FileText"
                size={48}
                className="mx-auto mb-3 opacity-50"
              />
              <p>История пополнений и списаний пуста</p>
            </div>
          ) : (
            <div className="space-y-3">
              {balanceHistory.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {transaction.type === "deposit" && (
                        <Icon
                          name="ArrowDownCircle"
                          size={16}
                          className="text-green-600"
                        />
                      )}
                      {transaction.type === "charge" && (
                        <Icon
                          name="ArrowUpCircle"
                          size={16}
                          className="text-red-600"
                        />
                      )}
                      {transaction.type === "refund" && (
                        <Icon
                          name="RefreshCw"
                          size={16}
                          className="text-blue-600"
                        />
                      )}
                      <span
                        className={`font-medium ${
                          transaction.type === "deposit" ||
                          transaction.type === "refund"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "deposit" ||
                        transaction.type === "refund"
                          ? "+"
                          : ""}
                        {transaction.amount.toFixed(2)} ₽
                      </span>
                      {transaction.is_deleted && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          <Icon name="Trash2" size={12} />
                          Удалено
                        </span>
                      )}
                    </div>
                    <p className="text-sm mb-1">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString(
                        "ru-RU",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalTransactions > transactionsPerPage && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <Icon name="ChevronLeft" size={16} />
                Назад
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Страница {currentPage} из{" "}
                {Math.ceil(totalTransactions / transactionsPerPage)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(
                      Math.ceil(totalTransactions / transactionsPerPage),
                      p + 1,
                    ),
                  )
                }
                disabled={
                  currentPage >=
                  Math.ceil(totalTransactions / transactionsPerPage)
                }
              >
                Вперёд
                <Icon name="ChevronRight" size={16} />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}