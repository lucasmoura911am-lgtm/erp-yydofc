import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, Clock, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, Building2, FileText, Shield, HardHat,
  Phone, Calendar, Target, Briefcase, BarChart3, Activity,
  ArrowUpRight, ArrowRight, RefreshCw, UserCheck, UserX,
  CircleDot, Zap, Star, PackageCheck, ClipboardList
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays, isToday, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
const today = format(new Date(), "yyyy-MM-dd");
const mStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
const mEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
const inMonth = (d) => d >= mStart && d <= mEnd;

// Compact KPI card
const KPI = ({ title, value, sub, icon: Icon, color, trend, href }) => {
  const colorMap = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-emerald-600",
    purple: "from-purple-500 to-indigo-600",
    orange: "from-orange-500 to-amber-600",
    red: "from-red-500 to-rose-600",
    teal: "from-teal-500 to-cyan-600",
    pink: "from-pink-500 to-rose-600",
    indigo: "from-indigo-500 to-violet-600",
  };
  const Wrapper = href ? Link : "div";
  return (
    <Wrapper to={href} className={`group bg-gradient-to-br ${colorMap[color] || colorMap.indigo} rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer`}>
      <div className="flex items-start justify-between">
        <div className="bg-white/20 rounded-xl p-2">
          <Icon className="w-5 h-5" />
        </div>
        {href && <ArrowUpRight className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />}
      </div>
      <p className="text-white/70 text-xs mt-3 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
      {sub && <p className="text-white/60 text-xs mt-0.5">{sub}</p>}
    </Wrapper>
  );
};

// Section header
const SectionHeader = ({ icon: Icon, title, color, href }) => (
  <div className={`flex items-center gap-2 mb-3`}>
    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
      <Icon className="w-4 h-4 text-white" />
    </div>
    <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm uppercase tracking-wide">{title}</h2>
    {href && <Link to={href} className="ml-auto text-xs text-indigo-500 hover:underline flex items-center gap-0.5">Ver mais <ArrowRight className="w-3 h-3" /></Link>}
  </div>
);

// Status dot
const Dot = ({ color }) => <span className={`inline-block w-2 h-2 rounded-full ${color} flex-shrink-0`} />;

export default function Overview360() {
  const [user, setUser] = useState(null);
  const [clock, setClock] = useState(new Date());

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  const cid = user?.company_id;
  const enabled = !!cid;

  // --- Data fetching (all parallel) ---
  const { data: employees = [] } = useQuery({ queryKey: ["ov_emp", cid], queryFn: () => base44.entities.Employee.filter({ company_id: cid }), enabled });
  const { data: timeRecords = [] } = useQuery({ queryKey: ["ov_tr", cid], queryFn: () => base44.entities.TimeRecord.filter({ company_id: cid }), enabled });
  const { data: clients = [] } = useQuery({ queryKey: ["ov_cli", cid], queryFn: () => base44.entities.Client.filter({ company_id: cid }), enabled });
  const { data: contracts = [] } = useQuery({ queryKey: ["ov_cnt", cid], queryFn: () => base44.entities.Contract.filter({ company_id: cid }), enabled });
  const { data: allocations = [] } = useQuery({ queryKey: ["ov_alloc", cid], queryFn: () => base44.entities.Allocation.filter({ company_id: cid }), enabled });
  const { data: tasks = [] } = useQuery({ queryKey: ["ov_tasks", cid], queryFn: () => base44.entities.Task.filter({ company_id: cid }), enabled });
  const { data: vacations = [] } = useQuery({ queryKey: ["ov_vac", cid], queryFn: () => base44.entities.VacationRequest.filter({ company_id: cid }), enabled });
  const { data: absences = [] } = useQuery({ queryKey: ["ov_abs", cid], queryFn: () => base44.entities.AbsenceJustification.filter({ company_id: cid }), enabled });
  const { data: payables = [] } = useQuery({ queryKey: ["ov_pay", cid], queryFn: () => base44.entities.AccountsPayable.filter({ company_id: cid }), enabled });
  const { data: receivables = [] } = useQuery({ queryKey: ["ov_rec", cid], queryFn: () => base44.entities.AccountsReceivable.filter({ company_id: cid }), enabled });
  const { data: cashflow = [] } = useQuery({ queryKey: ["ov_cf", cid], queryFn: () => base44.entities.CashFlow.filter({ company_id: cid }), enabled });
  const { data: opportunities = [] } = useQuery({ queryKey: ["ov_opp", cid], queryFn: () => base44.entities.CRMOpportunity.filter({ company_id: cid }), enabled });
  const { data: leads = [] } = useQuery({ queryKey: ["ov_leads", cid], queryFn: () => base44.entities.CRMLead.filter({ company_id: cid }), enabled });
  const { data: crmActivities = [] } = useQuery({ queryKey: ["ov_crm_act", cid], queryFn: () => base44.entities.CRMActivity.filter({ company_id: cid }), enabled });
  const { data: proposals = [] } = useQuery({ queryKey: ["ov_prop", cid], queryFn: () => base44.entities.CRMProposal.filter({ company_id: cid }), enabled });
  const { data: jobPositions = [] } = useQuery({ queryKey: ["ov_jobs", cid], queryFn: () => base44.entities.JobPosition.filter({ company_id: cid }), enabled });
  const { data: candidates = [] } = useQuery({ queryKey: ["ov_cand", cid], queryFn: () => base44.entities.Candidate.filter({ company_id: cid }), enabled });
  const { data: interviews = [] } = useQuery({ queryKey: ["ov_intv", cid], queryFn: () => base44.entities.Interview.filter({ company_id: cid }), enabled });
  const { data: epiDeliveries = [] } = useQuery({ queryKey: ["ov_epi", cid], queryFn: () => base44.entities.EPIDelivery.filter({ company_id: cid }), enabled });
  const { data: riskActions = [] } = useQuery({ queryKey: ["ov_risk", cid], queryFn: () => base44.entities.RiskActionPlan.filter({ company_id: cid }), enabled });
  const { data: safetyActivities = [] } = useQuery({ queryKey: ["ov_safety", cid], queryFn: () => base44.entities.EmployeeSafetyActivity.filter({ company_id: cid }), enabled });
  const { data: announcements = [] } = useQuery({ queryKey: ["ov_ann", cid], queryFn: () => base44.entities.Announcement.filter({ company_id: cid }), enabled });
  const { data: hoursBank = [] } = useQuery({ queryKey: ["ov_hb", cid], queryFn: () => base44.entities.HoursBank.filter({ company_id: cid }), enabled });

  // ========== COMPUTED METRICS ==========

  // PESSOAS
  const activeEmployees = employees.filter(e => e.status === "ativo" || !e.status).length;
  const todayRecords = timeRecords.filter(r => r.date === today);
  const presentToday = new Set(todayRecords.filter(r => r.type === "entrada").map(r => r.employee_id)).size;
  const absentToday = Math.max(0, activeEmployees - presentToday);
  const pendingVacations = vacations.filter(v => v.status === "pendente").length;
  const pendingAbsences = absences.filter(a => a.status === "pendente").length;
  const negativeHours = hoursBank.filter(h => (h.balance_minutes || 0) < 0).length;

  // FINANCEIRO
  const overduePayables = payables.filter(p => p.status === "pendente" && p.due_date < today);
  const overduePayTotal = overduePayables.reduce((s, p) => s + (p.amount || 0), 0);
  const overdueReceivables = receivables.filter(r => r.status === "pendente" && r.due_date < today);
  const overdueRecTotal = overdueReceivables.reduce((s, r) => s + (r.amount || 0), 0);
  const monthRevenue = cashflow.filter(c => c.type === "entrada" && inMonth(c.date)).reduce((s, c) => s + (c.amount || 0), 0);
  const monthExpense = cashflow.filter(c => c.type === "saida" && inMonth(c.date)).reduce((s, c) => s + (c.amount || 0), 0);
  const monthBalance = monthRevenue - monthExpense;
  const pendingPayables = payables.filter(p => p.status === "pendente").length;
  const pendingReceivables = receivables.filter(r => r.status === "pendente").length;

  // CRM / VENDAS
  const activePipeline = opportunities.filter(o => !["fechado_ganho", "fechado_perdido"].includes(o.stage));
  const pipelineValue = activePipeline.reduce((s, o) => s + (o.value || 0), 0);
  const wonThisMonth = opportunities.filter(o => o.stage === "fechado_ganho" && o.close_date >= mStart && o.close_date <= mEnd);
  const wonRevenue = wonThisMonth.reduce((s, o) => s + (o.value || 0), 0);
  const newLeadsMonth = leads.filter(l => l.created_date >= mStart).length;
  const pendingActivities = crmActivities.filter(a => a.status === "agendada").length;
  const openProposals = proposals.filter(p => p.status === "enviada").length;

  // CLIENTES / CONTRATOS
  const activeClients = clients.filter(c => c.status === "ativo" || !c.status).length;
  const activeContracts = contracts.filter(c => c.status === "ativo" || !c.status).length;
  const activeAllocations = allocations.filter(a => a.status === "ativo").length;

  // TAREFAS
  const openTasks = tasks.filter(t => t.status !== "concluida" && t.status !== "done").length;
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "concluida" && t.status !== "done").length;
  const doneTasks = tasks.filter(t => t.status === "concluida" || t.status === "done").length;
  const taskCompletion = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  // R&S
  const openJobs = jobPositions.filter(j => j.status === "aberta").length;
  const activeCandidates = candidates.filter(c => !["aprovado","reprovado","desistiu"].includes(c.kanban_stage)).length;
  const todayInterviews = interviews.filter(i => i.scheduled_date === today).length;
  const scheduledInterviews = interviews.filter(i => i.status === "agendada" && i.scheduled_date >= today).length;

  // SEGURANÇA
  const overdueRiskActions = riskActions.filter(a => a.status !== "concluido" && a.deadline < today).length;
  const pendingSafetyActs = safetyActivities.filter(a => a.status === "pendente" || a.status === "vencido").length;
  const expiredEPI = epiDeliveries.filter(e => e.status === "vencido" || (e.validity_date && e.validity_date < today)).length;

  // ALERTAS CRÍTICOS
  const alerts = [
    ...overduePayables.slice(0, 2).map(p => ({ type: "danger", msg: `Conta a pagar vencida: ${p.supplier_name} — ${fmt(p.amount)}`, href: "/AccountsPayablePage" })),
    ...overdueReceivables.slice(0, 2).map(r => ({ type: "warning", msg: `Receber vencido: ${fmt(r.amount)} (${r.due_date})`, href: "/AccountsReceivablePage" })),
    ...(overdueTasks > 0 ? [{ type: "warning", msg: `${overdueTasks} tarefa(s) em atraso`, href: "/ManageTasks" }] : []),
    ...(pendingVacations > 0 ? [{ type: "info", msg: `${pendingVacations} pedido(s) de férias aguardando aprovação`, href: "/ManageVacations" }] : []),
    ...(overdueRiskActions > 0 ? [{ type: "danger", msg: `${overdueRiskActions} ação(ões) de risco vencidas (PGR)`, href: "/RiskActionPlanPage" }] : []),
    ...(expiredEPI > 0 ? [{ type: "warning", msg: `${expiredEPI} EPI(s) com validade vencida`, href: "/EPIDeliveries" }] : []),
    ...(negativeHours > 0 ? [{ type: "info", msg: `${negativeHours} funcionário(s) com banco de horas negativo`, href: "/HoursBank" }] : []),
    ...(pendingAbsences > 0 ? [{ type: "info", msg: `${pendingAbsences} justificativa(s) de falta pendentes`, href: "/ManageAbsenceJustifications" }] : []),
  ].slice(0, 8);

  // Last announcements
  const recentAnnouncements = [...announcements].sort((a, b) => b.created_date?.localeCompare(a.created_date)).slice(0, 3);

  // Today's CRM activities
  const todayCRM = crmActivities.filter(a => a.date === today && a.status === "agendada").slice(0, 4);

  // Chart: last 7 days cashflow
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const label = format(subDays(new Date(), 6 - i), "dd/MM");
    const entrada = cashflow.filter(c => c.date === d && c.type === "entrada").reduce((s, c) => s + (c.amount || 0), 0);
    const saida = cashflow.filter(c => c.date === d && c.type === "saida").reduce((s, c) => s + (c.amount || 0), 0);
    return { label, entrada, saida };
  });

  // CRM funnel mini
  const funnelStages = [
    { label: "Leads", value: leads.length, color: "bg-gray-400" },
    { label: "Pipeline", value: activePipeline.length, color: "bg-blue-500" },
    { label: "Proposta", value: opportunities.filter(o => o.stage === "proposta_enviada").length, color: "bg-purple-500" },
    { label: "Negociação", value: opportunities.filter(o => o.stage === "negociacao").length, color: "bg-orange-500" },
    { label: "Ganho", value: opportunities.filter(o => o.stage === "fechado_ganho").length, color: "bg-green-500" },
  ];

  const alertColor = { danger: "border-l-red-500 bg-red-50 dark:bg-red-900/10", warning: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10", info: "border-l-blue-500 bg-blue-50 dark:bg-blue-900/10" };
  const alertIcon = { danger: <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />, warning: <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />, info: <CircleDot className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-6">

      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Overview <span className="text-indigo-600">360°</span></h1>
              <p className="text-xs text-gray-400">Painel executivo em tempo real</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-gray-800 dark:text-gray-100">{format(clock, "HH:mm:ss")}</p>
          <p className="text-xs text-gray-400">{format(clock, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      {/* TOP KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <KPI title="Funcionários Ativos" value={activeEmployees} sub={`${presentToday} presentes hoje`} icon={Users} color="indigo" href="/Employees" />
        <KPI title="Presentes Hoje" value={presentToday} sub={`${absentToday} ausentes`} icon={UserCheck} color="teal" href="/TimeRecords" />
        <KPI title="Saldo do Mês" value={fmt(monthBalance)} sub={monthBalance >= 0 ? "positivo ✓" : "negativo ✗"} icon={DollarSign} color={monthBalance >= 0 ? "green" : "red"} href="/CashFlowPage" />
        <KPI title="Pipeline CRM" value={fmt(pipelineValue)} sub={`${activePipeline.length} oportunidades`} icon={TrendingUp} color="purple" href="/CRMKanban" />
        <KPI title="Receita Fechada" value={fmt(wonRevenue)} sub="este mês" icon={Star} color="orange" href="/CRMOpportunities" />
        <KPI title="Clientes Ativos" value={activeClients} sub={`${activeContracts} contratos`} icon={Building2} color="blue" href="/Clients" />
        <KPI title="Tarefas Abertas" value={openTasks} sub={`${overdueTasks} em atraso`} icon={ClipboardList} color={overdueTasks > 0 ? "red" : "teal"} href="/ManageTasks" />
        <KPI title="Vagas Abertas" value={openJobs} sub={`${activeCandidates} candidatos`} icon={Briefcase} color="pink" href="/JobPositions" />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* COL 1: Alertas + Pessoas */}
        <div className="space-y-5">

          {/* ALERTAS */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={AlertTriangle} title="Alertas & Pendências" color="from-red-500 to-orange-500" />
              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Tudo em ordem!</span>
                  </div>
                ) : alerts.map((a, i) => (
                  <Link key={i} to={a.href} className={`flex items-start gap-2 p-2 rounded-lg border-l-4 ${alertColor[a.type]} hover:opacity-90 transition-opacity`}>
                    {alertIcon[a.type]}
                    <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight">{a.msg}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* PESSOAS */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={Users} title="Gestão de Pessoas" color="from-indigo-500 to-blue-600" href="/Employees" />
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: "Ativos", value: activeEmployees, color: "text-green-600" },
                  { label: "Presentes", value: presentToday, color: "text-blue-600" },
                  { label: "Férias Pendentes", value: pendingVacations, color: pendingVacations > 0 ? "text-orange-600" : "text-gray-500" },
                  { label: "Ausências Pend.", value: pendingAbsences, color: pendingAbsences > 0 ? "text-red-600" : "text-gray-500" },
                  { label: "Horas Negativas", value: negativeHours, color: negativeHours > 0 ? "text-red-600" : "text-gray-500" },
                  { label: "Alocações Ativas", value: activeAllocations, color: "text-indigo-600" },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2.5">
                    <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Presença hoje</span>
                  <span>{activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 100) : 0}%</span>
                </div>
                <Progress value={activeEmployees > 0 ? (presentToday / activeEmployees) * 100 : 0} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* AVISOS */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={Activity} title="Últimos Avisos" color="from-cyan-500 to-teal-600" href="/Announcements" />
              <div className="space-y-2">
                {recentAnnouncements.length === 0 ? <p className="text-xs text-gray-400 py-2">Nenhum aviso recente</p> :
                  recentAnnouncements.map(a => (
                    <div key={a.id} className="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.created_date?.slice(0, 10)}</p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COL 2: Financeiro + CRM */}
        <div className="space-y-5">

          {/* FINANCEIRO */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={DollarSign} title="Financeiro do Mês" color="from-green-500 to-emerald-600" href="/FinancialDashboard" />
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: "Receitas", value: fmt(monthRevenue), color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
                  { label: "Despesas", value: fmt(monthExpense), color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
                  { label: "Saldo", value: fmt(monthBalance), color: monthBalance >= 0 ? "text-green-700" : "text-red-700", bg: monthBalance >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20" },
                  { label: "A Pagar Vencido", value: fmt(overduePayTotal), color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
                  { label: "Pagar Pendentes", value: pendingPayables, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
                  { label: "A Receber Venc.", value: fmt(overdueRecTotal), color: overdueRecTotal > 0 ? "text-red-600" : "text-gray-500", bg: "bg-gray-50 dark:bg-gray-800/50" },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-xl p-2.5`}>
                    <p className={`text-sm font-bold ${item.color} truncate`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              {/* Mini chart */}
              <div className="mt-1">
                <p className="text-xs text-gray-400 mb-1">Fluxo últimos 7 dias</p>
                <ResponsiveContainer width="100%" height={70}>
                  <AreaChart data={last7}>
                    <defs>
                      <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                    </defs>
                    <Tooltip formatter={(v) => fmt(v)} labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="entrada" stroke="#10b981" fill="url(#gE)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="saida" stroke="#ef4444" fill="url(#gS)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* CRM */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={TrendingUp} title="CRM Comercial" color="from-purple-500 to-indigo-600" href="/CRMDashboard" />
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: "Pipeline", value: fmt(pipelineValue), color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
                  { label: "Ganho Mês", value: fmt(wonRevenue), color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
                  { label: "Leads Novos", value: newLeadsMonth, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                  { label: "Propostas Abertas", value: openProposals, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
                  { label: "Atividades Pend.", value: pendingActivities, color: pendingActivities > 0 ? "text-yellow-600" : "text-gray-500", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
                  { label: "Oportunidades", value: activePipeline.length, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-xl p-2.5`}>
                    <p className={`text-sm font-bold ${item.color} truncate`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              {/* Funnel mini */}
              <div className="space-y-1.5 mt-1">
                <p className="text-xs text-gray-400 mb-1">Funil de vendas</p>
                {funnelStages.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">{s.label}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
                      <div className={`${s.color} h-4 rounded-full flex items-center justify-end pr-1.5 transition-all`}
                        style={{ width: `${Math.max(8, (s.value / Math.max(...funnelStages.map(f => f.value), 1)) * 100)}%` }}>
                        <span className="text-white text-xs font-bold leading-none">{s.value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COL 3: Operações + R&S + Segurança */}
        <div className="space-y-5">

          {/* CLIENTES & CONTRATOS */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={Building2} title="Clientes & Contratos" color="from-blue-500 to-cyan-600" href="/Clients" />
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Clientes", value: activeClients, color: "text-blue-600" },
                  { label: "Contratos", value: activeContracts, color: "text-indigo-600" },
                  { label: "Lotações", value: activeAllocations, color: "text-teal-600" },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* TAREFAS */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={ClipboardList} title="Plano de Trabalho" color="from-teal-500 to-cyan-600" href="/TasksDashboard" />
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Abertas", value: openTasks, color: "text-blue-600" },
                  { label: "Em Atraso", value: overdueTasks, color: overdueTasks > 0 ? "text-red-600" : "text-gray-500" },
                  { label: "Concluídas", value: doneTasks, color: "text-green-600" },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-1">
                <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Conclusão geral</span><span>{taskCompletion}%</span></div>
                <Progress value={taskCompletion} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* R&S */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={Briefcase} title="Recrutamento & Seleção" color="from-pink-500 to-rose-600" href="/RecruitmentOverview" />
              <div className="grid grid-cols-2 gap-2 mb-2">
                {[
                  { label: "Vagas Abertas", value: openJobs, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-900/20" },
                  { label: "Em Processo", value: activeCandidates, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
                  { label: "Entrevistas Hoje", value: todayInterviews, color: todayInterviews > 0 ? "text-orange-600" : "text-gray-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
                  { label: "Agendadas", value: scheduledInterviews, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-xl p-2.5`}>
                    <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SEGURANÇA */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={Shield} title="Segurança do Trabalho" color="from-orange-500 to-red-500" href="/SafetyDashboard" />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Ações Vencidas", value: overdueRiskActions, color: overdueRiskActions > 0 ? "text-red-600" : "text-gray-500" },
                  { label: "PCMSO Pend.", value: pendingSafetyActs, color: pendingSafetyActs > 0 ? "text-orange-600" : "text-gray-500" },
                  { label: "EPI Vencido", value: expiredEPI, color: expiredEPI > 0 ? "text-red-600" : "text-gray-500" },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2.5 text-center">
                    <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BOTTOM: Atividades CRM de hoje + Pontos de atenção */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* CRM Today */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <SectionHeader icon={Phone} title="Atividades CRM — Hoje" color="from-violet-500 to-purple-600" href="/CRMActivities" />
            <div className="space-y-2">
              {todayCRM.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center">Nenhuma atividade agendada para hoje</p>
              ) : todayCRM.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.type === "ligacao" ? "bg-blue-100" : a.type === "reuniao" ? "bg-purple-100" : a.type === "whatsapp" ? "bg-green-100" : "bg-gray-100"}`}>
                    <Phone className={`w-4 h-4 ${a.type === "ligacao" ? "text-blue-600" : a.type === "reuniao" ? "text-purple-600" : a.type === "whatsapp" ? "text-green-600" : "text-gray-600"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate capitalize">{a.type.replace("_", " ")} {a.time ? `— ${a.time}` : ""}</p>
                    <p className="text-xs text-gray-400 truncate">{a.contact_person || a.description || "—"}</p>
                  </div>
                  <Badge className="text-xs bg-yellow-100 text-yellow-700 flex-shrink-0">{a.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Indicadores de saúde geral */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <SectionHeader icon={BarChart3} title="Saúde Geral da Operação" color="from-emerald-500 to-green-600" />
            <div className="space-y-3">
              {[
                { label: "Presença de funcionários", value: activeEmployees > 0 ? (presentToday / activeEmployees) * 100 : 100, color: "bg-blue-500" },
                { label: "Tarefas no prazo", value: tasks.length > 0 ? ((tasks.length - overdueTasks) / tasks.length) * 100 : 100, color: "bg-green-500" },
                { label: "Contas em dia (pagar)", value: payables.length > 0 ? ((payables.length - overduePayables.length) / payables.length) * 100 : 100, color: "bg-emerald-500" },
                { label: "Contas em dia (receber)", value: receivables.length > 0 ? ((receivables.length - overdueReceivables.length) / receivables.length) * 100 : 100, color: "bg-teal-500" },
                { label: "Segurança (ações PGR)", value: riskActions.length > 0 ? ((riskActions.length - overdueRiskActions) / riskActions.length) * 100 : 100, color: "bg-orange-500" },
                { label: "EPI válidos", value: epiDeliveries.length > 0 ? ((epiDeliveries.length - expiredEPI) / epiDeliveries.length) * 100 : 100, color: "bg-purple-500" },
              ].map(item => {
                const pct = Math.round(item.value);
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{item.label}</span>
                      <span className={`font-semibold ${pct >= 90 ? "text-green-600" : pct >= 70 ? "text-yellow-600" : "text-red-600"}`}>{pct}%</span>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                      <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}