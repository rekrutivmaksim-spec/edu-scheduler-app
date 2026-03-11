import { useState, useEffect } from "react";
import { GENERATION_COST } from "@/config/prices";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import AdminMenu from "@/components/AdminMenu";

const ADMIN_API =
  "https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15";

interface Payment {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  type: "deposit" | "charge" | "refund";
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  yookassa_payment_id: string | null;
  try_on_id: string | null;
  color_type_id: string | null;
  payment_id: string | null;
  created_at: string;
  is_deleted: boolean;
}

export default function AdminPayments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [yookassaFilter, setYookassaFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const paymentsPerPage = 50;

  useEffect(() => {
    fetchPayments();
  }, [currentPage, typeFilter, dateFilter, yookassaFilter, searchQuery]);

  const fetchPayments = async () => {
    setIsLoading(true);

    try {
      const offset = (currentPage - 1) * paymentsPerPage;

      let url = `${ADMIN_API}?action=payments&limit=${paymentsPerPage}&offset=${offset}`;

      if (typeFilter !== "all") {
        url += `&type=${typeFilter}`;
      }

      if (dateFilter !== "all") {
        const now = new Date();
        let dateFrom = "";

        if (dateFilter === "today") {
          dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        } else if (dateFilter === "week") {
          dateFrom = new Date(now.setDate(now.getDate() - 7)).toISOString();
        } else if (dateFilter === "month") {
          dateFrom = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        }

        if (dateFrom) {
          url += `&date_from=${dateFrom}`;
        }
      }

      if (yookassaFilter !== "all") {
        url += `&has_yookassa_id=${yookassaFilter}`;
      }

      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const response = await fetch(url, {
        credentials: "include",
      });

      if (response.status === 401) {
        navigate("/vf-console");
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch payments");
      const data = await response.json();
      setPayments(data.payments || data);
      setTotalPayments(
        data.total || (data.payments ? data.payments.length : data.length),
      );
    } catch (error) {
      toast.error("Ошибка загрузки платежей");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefund = async (userId: string, transactionId: string) => {
    const reason =
      prompt("Причина возврата (необязательно):") || "Возврат администратором";

    if (!confirm(`Вы уверены, что хотите вернуть ${GENERATION_COST}₽ пользователю?`)) {
      return;
    }

    setRefundingId(transactionId);

    try {
      const response = await fetch(`${ADMIN_API}?action=refund`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          amount: 50,
          reason,
          transaction_id: transactionId,
        }),
      });

      if (!response.ok) throw new Error("Refund failed");

      const data = await response.json();
      toast.success(
        `Возврат выполнен! Новый баланс: ${data.new_balance.toFixed(2)}₽`,
      );
      fetchPayments();
    } catch (error) {
      toast.error("Ошибка возврата средств");
    } finally {
      setRefundingId(null);
    }
  };

  const handleDeduct = async (userId: string, transactionId: string) => {
    // Получаем актуальный баланс пользователя
    setRefundingId(transactionId);
    let actualBalance = 0;

    try {
      const balanceResponse = await fetch(
        `${ADMIN_API}?action=get_user_balance&user_id=${userId}`,
        {
          credentials: "include",
        },
      );

      if (!balanceResponse.ok) {
        throw new Error("Failed to fetch balance");
      }

      const balanceData = await balanceResponse.json();
      actualBalance = balanceData.balance || 0;
    } catch (error) {
      toast.error("Не удалось получить текущий баланс");
      setRefundingId(null);
      return;
    }

    setRefundingId(null);

    const amountStr = prompt(
      `Введите сумму списания (текущий баланс: ${actualBalance.toFixed(2)}₽):`,
    );

    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Некорректная сумма");
      return;
    }

    if (amount > actualBalance) {
      toast.error(`Недостаточно средств. Баланс: ${actualBalance.toFixed(2)}₽`);
      return;
    }

    const reason = prompt("Причина списания (обязательно):");
    if (!reason || reason.trim() === "") {
      toast.error("Необходимо указать причину списания");
      return;
    }

    if (
      !confirm(
        `Вы уверены, что хотите списать ${amount.toFixed(2)}₽ с баланса пользователя?`,
      )
    ) {
      return;
    }

    setRefundingId(transactionId);

    try {
      const response = await fetch(`${ADMIN_API}?action=deduct_balance`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          amount: amount,
          reason: reason.trim(),
          payment_transaction_id: transactionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Deduction failed");
      }

      const data = await response.json();
      toast.success(
        `Списание выполнено! Новый баланс: ${data.new_balance.toFixed(2)}₽`,
      );
      fetchPayments();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ошибка списания средств";
      toast.error(errorMessage);
    } finally {
      setRefundingId(null);
    }
  };

  const totalDeposits = payments
    .filter((p) => p.type === "deposit")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalCharges = payments
    .filter((p) => p.type === "charge")
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" className="animate-spin" size={48} />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />

          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">История операций</h1>
              <p className="text-muted-foreground">
                Всего операций: {totalPayments} | Пополнения:{" "}
                {totalDeposits.toFixed(2)} ₽ | Списания:{" "}
                {totalCharges.toFixed(2)} ₽
              </p>
            </div>

            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Тип операции
                    </label>
                    <Select
                      value={typeFilter}
                      onValueChange={(value) => {
                        setTypeFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Все" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все</SelectItem>
                        <SelectItem value="deposit">Пополнение</SelectItem>
                        <SelectItem value="charge">Списание</SelectItem>
                        <SelectItem value="refund">Возврат</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Период
                    </label>
                    <Select
                      value={dateFilter}
                      onValueChange={(value) => {
                        setDateFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Всё время" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Всё время</SelectItem>
                        <SelectItem value="today">Сегодня</SelectItem>
                        <SelectItem value="week">Неделя</SelectItem>
                        <SelectItem value="month">Месяц</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      ID ЮКассы
                    </label>
                    <Select
                      value={yookassaFilter}
                      onValueChange={(value) => {
                        setYookassaFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Все" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все</SelectItem>
                        <SelectItem value="true">Есть</SelectItem>
                        <SelectItem value="false">Нет</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Поиск
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Email, имя, ID, описание..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pr-8"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setCurrentPage(1);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <Icon name="X" size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {(typeFilter !== "all" ||
                  dateFilter !== "all" ||
                  yookassaFilter !== "all" ||
                  searchQuery) && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Применены фильтры
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTypeFilter("all");
                        setDateFilter("all");
                        setYookassaFilter("all");
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
                    >
                      <Icon name="X" size={14} className="mr-1" />
                      Сбросить всё
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Пользователь
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Тип
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Сумма
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Описание
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          ID операции
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          ID ЮКассы
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Баланс
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr
                          key={payment.id}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium">
                              {payment.user_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {payment.user_email}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                payment.type === "deposit"
                                  ? "bg-green-100 text-green-700"
                                  : payment.type === "refund"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {payment.type === "deposit"
                                ? "Пополнение"
                                : payment.type === "refund"
                                  ? "Возврат"
                                  : "Списание"}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-3 text-sm font-medium ${
                              payment.type === "deposit" ||
                              payment.type === "refund"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {payment.type === "deposit" ||
                            payment.type === "refund"
                              ? "+"
                              : ""}
                            {payment.amount.toFixed(2)} ₽
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {payment.description}
                            {payment.is_deleted && (
                              <span className="ml-2 text-xs text-gray-500">
                                (удалено)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                            {payment.try_on_id ||
                            payment.color_type_id ||
                            payment.payment_id ? (
                              <div className="flex items-center gap-1">
                                <span
                                  className="truncate max-w-[120px]"
                                  title={
                                    payment.try_on_id ||
                                    payment.color_type_id ||
                                    payment.payment_id ||
                                    ""
                                  }
                                >
                                  {(
                                    payment.try_on_id ||
                                    payment.color_type_id ||
                                    payment.payment_id ||
                                    ""
                                  ).substring(0, 8)}
                                  ...
                                </span>
                                <button
                                  onClick={() => {
                                    const id =
                                      payment.try_on_id ||
                                      payment.color_type_id ||
                                      payment.payment_id;
                                    if (id) {
                                      navigator.clipboard.writeText(id);
                                      toast.success("ID скопирован");
                                    }
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Icon name="Copy" size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                            {payment.yookassa_payment_id ? (
                              <div className="flex items-center gap-1">
                                <span
                                  className="truncate max-w-[200px]"
                                  title={payment.yookassa_payment_id}
                                >
                                  {payment.yookassa_payment_id}
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      payment.yookassa_payment_id!,
                                    );
                                    toast.success("ID скопирован");
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Icon name="Copy" size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {payment.balance_after.toFixed(2)} ₽
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(payment.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {payment.type === "charge" &&
                                payment.amount < 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleRefund(payment.user_id, payment.id)
                                    }
                                    disabled={refundingId === payment.id}
                                  >
                                    {refundingId === payment.id ? (
                                      <>
                                        <Icon
                                          name="Loader2"
                                          className="animate-spin mr-1"
                                          size={14}
                                        />
                                        Возврат...
                                      </>
                                    ) : (
                                      <>
                                        <Icon
                                          name="RefreshCw"
                                          className="mr-1"
                                          size={14}
                                        />
                                        Вернуть
                                      </>
                                    )}
                                  </Button>
                                )}
                              {payment.type === "deposit" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    handleDeduct(payment.user_id, payment.id)
                                  }
                                  disabled={refundingId === payment.id}
                                >
                                  {refundingId === payment.id ? (
                                    <>
                                      <Icon
                                        name="Loader2"
                                        className="animate-spin mr-1"
                                        size={14}
                                      />
                                      Списание...
                                    </>
                                  ) : (
                                    <>
                                      <Icon
                                        name="Minus"
                                        className="mr-1"
                                        size={14}
                                      />
                                      Списать
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {totalPayments > paymentsPerPage && (
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
                  {Math.ceil(totalPayments / paymentsPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(
                        Math.ceil(totalPayments / paymentsPerPage),
                        p + 1,
                      ),
                    )
                  }
                  disabled={
                    currentPage >= Math.ceil(totalPayments / paymentsPerPage)
                  }
                >
                  Вперёд
                  <Icon name="ChevronRight" size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}