import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const COLORS = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function FinancialDashboard() {
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const cid = user?.company_id;

  const { data: payables = [] } = useQuery({
    queryKey: ["ap", cid], queryFn: () => base44.entities.AccountsPayable.filter({ company_id: cid }), enabled: !!cid
  });
  const { data: receivables = [] } = useQuery({
    queryKey: ["ar", cid], queryFn: () => base44.entities.AccountsReceivable.filter({ company_id: cid }), enabled: !!cid
  });
  const { data: cashFlows = [] } = useQuery({
    queryKey: ["cf", cid], queryFn: () => base44.entities.CashFlow.filter({ company_id: cid }), enabled: !!cid
  });
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cc", cid], queryFn: () => base44.entities.CostCenter.filter({ company_id: cid }), enabled: !!cid
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["coa", cid], queryFn: () => base44.entities.ChartOfAccounts.filter({ company_id: cid }), enabled: !!cid
  });
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["ba", cid], queryFn: () => base44.entities.BankAccount.filter({ company_id: cid }), enabled: !!cid
  });

  const [selYear, selMonth] = selectedMonth.split("-");
  const mStart = startOfMonth(new Date(parseInt(selYear), parseInt(selMonth) - 1, 1));
  const mEnd = endOfMonth(mStart);

  const inMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr + "T00:00:00");
    return d >= mStart && d <= mEnd;
  };

  // KPIs do mês
  const monthRevenue = receivables.filter(r => r.status === "recebido" && inMonth(r.payment_date)).reduce((s, r) => s + (r.amount || 0), 0);
  const monthExpenses = payables.filter(p => p.status === "pago" && inMonth(p.payment_date)).reduce((s, p) => s + (p.amount || 0), 0);
  const profit = monthRevenue - monthExpenses;

  const overduePayables = payables.filter(p => p.status === "pendente" && p.due_date && new Date(p.due_date + "T00:00:00") < new Date()).reduce((s, p) => s + (p.amount || 0), 0);
  const overdueReceivables = receivables.filter(r => r.status === "pendente" && r.due_date && new Date(r.due_date + "T00:00:00") < new Date()).reduce((s, r) => s + (r.amount || 0), 0);
  const totalBankBalance = bankAccounts.reduce((s, b) => s + (b.current_balance || b.initial_balance || 0), 0);

  // Monthly revenue/expense chart (last 6 months)
  const last6 = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() });
  const monthlyChart = last6.map(m => {
    const label = format(m, "MMM/yy", { locale: ptBR });
    const ms = startOfMonth(m);
    const me = endOfMonth(m);
    const inM = (d) => { if (!d) return false; const dt = new Date(d + "T00:00:00"); return dt >= ms && dt <= me; };
    const rev = receivables.filter(r => r.status === "recebido" && inM(r.payment_date)).reduce((s, r) => s + (r.amount || 0), 0);
    const exp = payables.filter(p => p.status === "pago" && inM(p.payment_date)).reduce((s, p) => s + (p.amount || 0), 0);
    return { month: label, receita: rev, despesa: exp, lucro: rev - exp };
  });

  // Expense by category
  const expByCategory = categories.filter(c => c.type === "despesa").map(cat => {
    const total = payables.filter(p => p.category_id === cat.id && inMonth(p.due_date)).reduce((s, p) => s + (p.amount || 0), 0);
    return { name: cat.name, value: total };
  }).filter(d => d.value > 0);

  // Expense by cost center
  const expByCostCenter = costCenters.map(cc => {
    const total = payables.filter(p => p.cost_center_id === cc.id && inMonth(p.due_date)).reduce((s, p) => s + (p.amount || 0), 0);
    return { name: cc.name, value: total, budget: cc.budget || 0 };
  }).filter(d => d.value > 0 || d.budget > 0);

  // Cumulative cash flow (last 30 days)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return format(d, "yyyy-MM-dd");
  });
  let cumulative = 0;
  const cumulativeFlow = last30Days.map(dateStr => {
    const dayIn = cashFlows.filter(f => f.date === dateStr && f.type === "entrada").reduce((s, f) => s + (f.amount || 0), 0);
    const dayOut = cashFlows.filter(f => f.date === dateStr && f.type === "saida").reduce((s, f) => s + (f.amount || 0), 0);
    cumulative += dayIn - dayOut;
    return { date: dateStr.slice(5), saldo: cumulative };
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM/yyyy", { locale: ptBR }) };
  });

  const KPICard = ({ title, value, icon: Icon, colorClass, trend, trendLabel }) => (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className={`text-xl font-bold mt-1 ${colorClass}`}>{value}</p>
            {trendLabel && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                {trend > 0 ? <ArrowUpRight className="w-3 h-3 text-green-500" /> : <ArrowDownRight className="w-3 h-3 text-red-500" />}
                {trendLabel}
              </p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass.includes("green") ? "bg-green-50 dark:bg-green-900/20" : colorClass.includes("red") ? "bg-red-50 dark:bg-red-900/20" : colorClass.includes("blue") ? "bg-blue-50 dark:bg-blue-900/20" : "bg-purple-50 dark:bg-purple-900/20"}`}>
            <Icon className={`w-5 h-5 ${colorClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard Financeiro</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Visão gerencial completa</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Receita do Mês" value={fmt(monthRevenue)} icon={TrendingUp} colorClass="text-green-600" />
        <KPICard title="Despesas do Mês" value={fmt(monthExpenses)} icon={TrendingDown} colorClass="text-red-600" />
        <KPICard title="Lucro Operacional" value={fmt(profit)} icon={DollarSign} colorClass={profit >= 0 ? "text-emerald-600" : "text-red-600"} />
        <KPICard title="Saldo em Caixa" value={fmt(totalBankBalance)} icon={Wallet} colorClass="text-blue-600" />
        <KPICard title="A Pagar Vencido" value={fmt(overduePayables)} icon={AlertCircle} colorClass="text-orange-600" />
        <KPICard title="A Receber Vencido" value={fmt(overdueReceivables)} icon={AlertCircle} colorClass="text-yellow-600" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Receitas x Despesas (6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Fluxo de Caixa Acumulado (30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cumulativeFlow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#7c3aed" fill="#ede9fe" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            {expByCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={expByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {expByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Realizado x Orçamento por Centro de Custo</CardTitle></CardHeader>
          <CardContent>
            {expByCostCenter.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={expByCostCenter} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="value" name="Realizado" fill="#7c3aed" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="budget" name="Orçamento" fill="#c4b5fd" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lucro mensal trend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Resultado Mensal (Lucro/Prejuízo)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Area type="monotone" dataKey="lucro" name="Resultado" stroke="#10b981" fill="#d1fae5" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}