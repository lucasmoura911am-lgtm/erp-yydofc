import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, ClipboardList, AlertTriangle, CheckCircle2, XCircle, Filter, Download, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const today = format(new Date(), "yyyy-MM-dd");
const mStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
const mEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

const TYPE_LABELS = {
  operacional: "Operacional", administrativo: "Administrativo",
  comercial: "Comercial", atendimento: "Atendimento",
  financeiro: "Financeiro", reuniao: "Reunião",
  suporte: "Suporte", externo: "Externo"
};

const COLORS = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16"];

export default function ProductivityManager() {
  const [user, setUser] = useState(null);
  const [period, setPeriod] = useState("month");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [startDate, setStartDate] = useState(mStart);
  const [endDate, setEndDate] = useState(mEnd);

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;
  const enabled = !!cid;

  useEffect(() => {
    const now = new Date();
    if (period === "today") { setStartDate(today); setEndDate(today); }
    else if (period === "week") { setStartDate(format(subDays(now, 7), "yyyy-MM-dd")); setEndDate(today); }
    else if (period === "month") { setStartDate(mStart); setEndDate(mEnd); }
  }, [period]);

  const { data: activities = [] } = useQuery({ queryKey: ["pm_act", cid], queryFn: () => base44.entities.WorkActivity.filter({ company_id: cid }), enabled });
  const { data: ptasks = [] } = useQuery({ queryKey: ["pm_pt", cid], queryFn: () => base44.entities.ProductivityTask.filter({ company_id: cid }), enabled });
  const { data: appointments = [] } = useQuery({ queryKey: ["pm_apt", cid], queryFn: () => base44.entities.Appointment.filter({ company_id: cid }), enabled });
  const { data: employees = [] } = useQuery({ queryKey: ["pm_emps", cid], queryFn: () => base44.entities.Employee.filter({ company_id: cid }), enabled });

  const activeEmps = employees.filter(e => e.status !== "inactive");

  // Filtered activities
  const filteredActs = activities.filter(a => {
    const inPeriod = a.date >= startDate && a.date <= endDate;
    const byEmp = filterEmployee === "all" || a.employee_email === filterEmployee;
    const byType = filterType === "all" || a.type === filterType;
    return inPeriod && byEmp && byType;
  });

  // Employees with/without activity today
  const empWithToday = new Set(activities.filter(a => a.date === today).map(a => a.employee_email));
  const noActivityToday = activeEmps.filter(e => !empWithToday.has(e.user_email));

  // Overdue tasks
  const overdueTasks = ptasks.filter(t => t.due_date && t.due_date < today && t.status !== "concluido");
  const pendingTasks = ptasks.filter(t => t.status === "pendente" || t.status === "em_andamento");

  // Activity by employee
  const byEmployee = activeEmps.map(e => ({
    name: e.full_name?.split(" ")[0] || "—",
    full: e.full_name,
    email: e.user_email,
    count: filteredActs.filter(a => a.employee_email === e.user_email).length,
    mins: filteredActs.filter(a => a.employee_email === e.user_email).reduce((s, a) => s + (a.duration_minutes || 0), 0),
    tasks: ptasks.filter(t => t.responsible_email === e.user_email && t.status === "concluido").length,
  })).sort((a, b) => b.count - a.count);

  // Activity by type
  const byType = Object.entries(TYPE_LABELS).map(([key, label]) => ({
    name: label,
    value: filteredActs.filter(a => a.type === key).length,
  })).filter(i => i.value > 0);

  // Last 7 days
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    return {
      label: format(subDays(new Date(), 6 - i), "dd/MM"),
      count: activities.filter(a => a.date === d).length,
    };
  });

  const exportCSV = () => {
    const rows = [["Funcionário", "Data", "Tipo", "Início", "Fim", "Duração (min)", "Descrição", "Cliente/Projeto", "Status"]];
    filteredActs.forEach(a => rows.push([a.employee_name || a.employee_email, a.date, TYPE_LABELS[a.type] || a.type, a.start_time || "", a.end_time || "", a.duration_minutes || "", a.description || "", a.client_or_project || "", a.status]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `produtividade_${startDate}_${endDate}.csv`; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">👔 Visão do Gestor</h1>
          <p className="text-sm text-gray-400">Acompanhe a produtividade da equipe em tempo real</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* FILTERS */}
      <div className="flex gap-3 flex-wrap bg-white dark:bg-gray-900 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex gap-1">
          {[["today","Hoje"],["week","7 dias"],["month","Este mês"],["custom","Personalizado"]].map(([v, l]) => (
            <Button key={v} variant={period === v ? "default" : "ghost"} size="sm" onClick={() => setPeriod(v)} className={period === v ? "bg-violet-600 text-white" : ""}>{l}</Button>
          ))}
        </div>
        {period === "custom" && (
          <>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
          </>
        )}
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Funcionário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funcionários</SelectItem>
            {activeEmps.map(e => <SelectItem key={e.id} value={e.user_email || e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Atividades no período", value: filteredActs.length, icon: ClipboardList, color: "from-violet-500 to-indigo-600" },
          { label: "Funcionários ativos", value: activeEmps.length, icon: Users, color: "from-blue-500 to-cyan-600" },
          { label: "Sem registro hoje", value: noActivityToday.length, icon: XCircle, color: noActivityToday.length > 0 ? "from-orange-500 to-red-500" : "from-green-500 to-emerald-500" },
          { label: "Tarefas atrasadas", value: overdueTasks.length, icon: AlertTriangle, color: overdueTasks.length > 0 ? "from-red-500 to-rose-600" : "from-green-500 to-teal-600" },
        ].map(k => (
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <div className="bg-white/20 rounded-xl p-2 w-fit mb-3"><k.icon className="w-4 h-4" /></div>
            <p className="text-2xl font-black">{k.value}</p>
            <p className="text-white/70 text-xs mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Atividades por dia */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-500" /> Atividades — Últimos 7 dias
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={last7} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Atividades" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Atividades por tipo */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3">Distribuição por Tipo</h3>
            {byType.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Nenhuma atividade no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Produtividade por funcionário */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Produtividade por Funcionário
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-800">
                    <th className="text-left py-2 text-xs font-bold text-gray-500">Funcionário</th>
                    <th className="text-center py-2 text-xs font-bold text-gray-500">Atividades</th>
                    <th className="text-center py-2 text-xs font-bold text-gray-500">Horas reg.</th>
                    <th className="text-center py-2 text-xs font-bold text-gray-500">Tarefas concl.</th>
                    <th className="text-center py-2 text-xs font-bold text-gray-500">Reg. hoje</th>
                  </tr>
                </thead>
                <tbody>
                  {byEmployee.map(e => (
                    <tr key={e.email} className="border-b dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-2.5 font-medium text-gray-800 dark:text-gray-200">{e.full}</td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${e.count > 0 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-400"}`}>{e.count}</span>
                      </td>
                      <td className="text-center text-gray-500 text-xs">{e.mins > 0 ? `${Math.floor(e.mins / 60)}h${e.mins % 60 > 0 ? String(e.mins % 60).padStart(2, "0") + "m" : ""}` : "—"}</td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${e.tasks > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>{e.tasks}</span>
                      </td>
                      <td className="text-center">
                        {empWithToday.has(e.email)
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                          : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Sem registro hoje */}
        {noActivityToday.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
            <CardContent className="p-4">
              <h3 className="font-bold text-orange-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Sem registro hoje ({noActivityToday.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {noActivityToday.map(e => (
                  <div key={e.id} className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/10 rounded-xl">
                    <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 text-xs font-bold flex-shrink-0">
                      {e.full_name?.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{e.full_name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tarefas atrasadas */}
        {overdueTasks.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Tarefas Atrasadas ({overdueTasks.length})
              </h3>
              <div className="space-y-2">
                {overdueTasks.slice(0, 6).map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.responsible_name} · venceu em {t.due_date}</p>
                    </div>
                    <Badge className="text-xs bg-red-100 text-red-700 flex-shrink-0">
                      {t.priority === "urgente" ? "🚨 Urgente" : t.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}