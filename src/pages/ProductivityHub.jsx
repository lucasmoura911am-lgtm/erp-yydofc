import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, isToday, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LayoutDashboard, ClipboardList, Calendar, CheckSquare, Bell,
  TrendingUp, Plus, Clock, AlertTriangle, ChevronRight,
  Zap, Star, Activity, Target, Users, ArrowUpRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const today = format(new Date(), "yyyy-MM-dd");

const typeLabels = {
  operacional: "Operacional", administrativo: "Administrativo",
  comercial: "Comercial", atendimento: "Atendimento",
  financeiro: "Financeiro", reuniao: "Reunião",
  suporte: "Suporte", externo: "Externo"
};

const typeColors = {
  operacional: "bg-blue-100 text-blue-700", administrativo: "bg-gray-100 text-gray-700",
  comercial: "bg-purple-100 text-purple-700", atendimento: "bg-green-100 text-green-700",
  financeiro: "bg-emerald-100 text-emerald-700", reuniao: "bg-orange-100 text-orange-700",
  suporte: "bg-cyan-100 text-cyan-700", externo: "bg-red-100 text-red-700"
};

const priorityColors = {
  baixa: "bg-gray-100 text-gray-600", media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700", urgente: "bg-red-100 text-red-700"
};

export default function ProductivityHub() {
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;
  const uemail = user?.email;
  const enabled = !!cid;
  const isAdmin = user?.role === "admin";

  const { data: activities = [] } = useQuery({ queryKey: ["ph_act", cid], queryFn: () => base44.entities.WorkActivity.filter({ company_id: cid }), enabled });
  const { data: appointments = [] } = useQuery({ queryKey: ["ph_apt", cid], queryFn: () => base44.entities.Appointment.filter({ company_id: cid }), enabled });
  const { data: ptasks = [] } = useQuery({ queryKey: ["ph_pt", cid], queryFn: () => base44.entities.ProductivityTask.filter({ company_id: cid }), enabled });
  const { data: notices = [] } = useQuery({ queryKey: ["ph_notices", cid], queryFn: () => base44.entities.InternalNotice.filter({ company_id: cid, active: true }), enabled });
  const { data: employees = [] } = useQuery({ queryKey: ["ph_emps", cid], queryFn: () => base44.entities.Employee.filter({ company_id: cid }), enabled });

  // My data
  const myActivitiesToday = activities.filter(a => a.employee_email === uemail && a.date === today);
  const myAppointmentsToday = appointments.filter(a => a.employee_email === uemail && a.date === today && a.status !== "cancelado");
  const myPendingTasks = ptasks.filter(t => t.responsible_email === uemail && t.status !== "concluido");
  const myOverdueTasks = myPendingTasks.filter(t => t.due_date && t.due_date < today);

  // Company
  const todayActivities = activities.filter(a => a.date === today).length;
  const activeEmps = employees.filter(e => e.status !== "inactive").length;
  const empWithActivity = new Set(activities.filter(a => a.date === today).map(a => a.employee_email)).size;
  const overdueTasks = ptasks.filter(t => t.due_date && t.due_date < today && t.status !== "concluido").length;

  // My notices
  const myNotices = notices.filter(n =>
    n.type === "empresa" || n.responsible_email === uemail ||
    (n.target_emails || []).includes(uemail)
  ).slice(0, 4);

  // Activity by type chart (last 7 days)
  const actByType = Object.entries(typeLabels).map(([key, label]) => ({
    name: label.slice(0, 5),
    value: activities.filter(a => a.type === key && a.employee_email === uemail).length
  })).filter(i => i.value > 0);

  // Task completion
  const myTotal = ptasks.filter(t => t.responsible_email === uemail).length;
  const myDone = ptasks.filter(t => t.responsible_email === uemail && t.status === "concluido").length;
  const completion = myTotal > 0 ? Math.round((myDone / myTotal) * 100) : 0;

  const upcomingAppts = appointments
    .filter(a => a.employee_email === uemail && a.date >= today && a.status !== "cancelado")
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time?.localeCompare(b.start_time))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Central de Produtividade</h1>
            <p className="text-sm text-gray-400">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/WorkActivities">
            <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Registrar Atividade
            </Button>
          </Link>
        </div>
      </div>

      {/* OVERDUE ALERT */}
      {myOverdueTasks.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 dark:text-red-400">Você tem {myOverdueTasks.length} tarefa(s) em atraso!</p>
            <p className="text-sm text-red-500">Acesse o Kanban de Tarefas para resolver.</p>
          </div>
          <Link to="/ProductivityKanban"><Button variant="outline" size="sm" className="border-red-300 text-red-700">Ver tarefas</Button></Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Atividades Hoje", value: myActivitiesToday.length, icon: ClipboardList, color: "from-violet-500 to-indigo-600", href: "/WorkActivities" },
          { label: "Compromissos Hoje", value: myAppointmentsToday.length, icon: Calendar, color: "from-blue-500 to-cyan-600", href: "/ProductivityAgenda" },
          { label: "Tarefas Pendentes", value: myPendingTasks.length, icon: CheckSquare, color: myPendingTasks.length > 0 ? "from-orange-500 to-amber-500" : "from-green-500 to-emerald-500", href: "/ProductivityKanban" },
          { label: "Taxa de Conclusão", value: `${completion}%`, icon: Target, color: "from-teal-500 to-green-500", href: "/ProductivityKanban" },
        ].map(k => (
          <Link key={k.label} to={k.href} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5`}>
            <div className="flex items-start justify-between mb-3">
              <div className="bg-white/20 rounded-xl p-2"><k.icon className="w-4 h-4" /></div>
              <ArrowUpRight className="w-4 h-4 opacity-60" />
            </div>
            <p className="text-2xl font-black">{k.value}</p>
            <p className="text-white/70 text-xs mt-0.5">{k.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* COL 1 */}
        <div className="space-y-5">

          {/* Today's activities */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Atividades de Hoje</h3>
                </div>
                <Link to="/WorkActivities" className="text-xs text-violet-500 hover:underline flex items-center gap-0.5">
                  Ver todas <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {myActivitiesToday.length === 0 ? (
                  <div className="text-center py-6">
                    <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Nenhuma atividade registrada hoje</p>
                    <Link to="/WorkActivities">
                      <Button size="sm" className="mt-2 bg-violet-600 hover:bg-violet-700 text-white">
                        <Plus className="w-3 h-3 mr-1" /> Registrar
                      </Button>
                    </Link>
                  </div>
                ) : myActivitiesToday.map(a => (
                  <div key={a.id} className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{a.description?.slice(0, 50)}...</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[a.type]}`}>{typeLabels[a.type]}</span>
                        {a.start_time && <span className="text-xs text-gray-400">{a.start_time}{a.end_time ? ` - ${a.end_time}` : ""}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${a.status === "finalizado" ? "bg-green-100 text-green-700" : a.status === "pausado" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                      {a.status === "finalizado" ? "✓" : a.status === "pausado" ? "⏸" : "●"}
                    </span>
                  </div>
                ))}
              </div>
              {myActivitiesToday.length > 0 && (
                <div className="mt-3">
                  <Progress value={myActivitiesToday.filter(a => a.status === "finalizado").length / myActivitiesToday.length * 100} className="h-1.5" />
                  <p className="text-xs text-gray-400 mt-1">{myActivitiesToday.filter(a => a.status === "finalizado").length}/{myActivitiesToday.length} finalizadas</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notices */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Avisos & Lembretes</h3>
                </div>
                <Link to="/ProductivityNotices" className="text-xs text-amber-500 hover:underline flex items-center gap-0.5">
                  Ver todos <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {myNotices.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum aviso ativo</p>
                ) : myNotices.map(n => (
                  <div key={n.id} className={`p-2.5 rounded-xl border-l-4 ${
                    n.priority === "urgente" ? "border-l-red-500 bg-red-50 dark:bg-red-900/10" :
                    n.priority === "alta" ? "border-l-orange-500 bg-orange-50 dark:bg-orange-900/10" :
                    n.priority === "media" ? "border-l-blue-500 bg-blue-50 dark:bg-blue-900/10" :
                    "border-l-gray-300 bg-gray-50 dark:bg-gray-800/50"
                  }`}>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{n.notice_date}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${priorityColors[n.priority]}`}>{n.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COL 2 */}
        <div className="space-y-5">

          {/* My tasks */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Minhas Tarefas</h3>
                </div>
                <Link to="/ProductivityKanban" className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                  Kanban <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Pendente", value: myPendingTasks.filter(t => t.status === "pendente").length, color: "text-gray-600" },
                  { label: "Em andamento", value: myPendingTasks.filter(t => t.status === "em_andamento").length, color: "text-blue-600" },
                  { label: "Atrasadas", value: myOverdueTasks.length, color: myOverdueTasks.length > 0 ? "text-red-600" : "text-gray-400" },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2.5 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {myPendingTasks.slice(0, 6).map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.priority === "urgente" ? "bg-red-500" : t.priority === "alta" ? "bg-orange-500" : t.priority === "media" ? "bg-blue-500" : "bg-gray-400"}`} />
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{t.title}</p>
                    {t.due_date && <span className={`text-xs flex-shrink-0 ${t.due_date < today ? "text-red-500 font-bold" : "text-gray-400"}`}>{t.due_date?.slice(5)}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming appointments */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Próximos Compromissos</h3>
                </div>
                <Link to="/ProductivityAgenda" className="text-xs text-teal-500 hover:underline flex items-center gap-0.5">
                  Agenda <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {upcomingAppts.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Nenhum compromisso agendado</p>
                  </div>
                ) : upcomingAppts.map(a => (
                  <div key={a.id} className="flex items-start gap-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-2 flex-shrink-0 text-center min-w-[44px]">
                      <p className="text-xs text-teal-600 font-bold">{a.date?.slice(5, 7)}/{a.date?.slice(8)}</p>
                      <p className="text-xs text-teal-500">{a.start_time}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{a.title}</p>
                      {a.location && <p className="text-xs text-gray-400 truncate">📍 {a.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COL 3 */}
        <div className="space-y-5">

          {/* Activity chart */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Minhas Atividades por Tipo</h3>
              </div>
              {actByType.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma atividade registrada ainda</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={actByType} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Company stats (admin) */}
          {isAdmin && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Visão da Empresa — Hoje</h3>
                  </div>
                  <Link to="/ProductivityManager" className="text-xs text-green-500 hover:underline flex items-center gap-0.5">
                    Gestão <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Atividades Hoje", value: todayActivities, color: "text-violet-600" },
                    { label: "Funcionários c/ Registro", value: empWithActivity, color: "text-green-600" },
                    { label: "Sem registro hoje", value: Math.max(0, activeEmps - empWithActivity), color: "text-orange-600" },
                    { label: "Tarefas Atrasadas", value: overdueTasks, color: overdueTasks > 0 ? "text-red-600" : "text-gray-500" },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2.5">
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick nav */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm mb-3">Acesso Rápido</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Diário", icon: ClipboardList, href: "/WorkActivities", color: "bg-violet-50 dark:bg-violet-900/20 text-violet-700" },
                  { label: "Agenda", icon: Calendar, href: "/ProductivityAgenda", color: "bg-teal-50 dark:bg-teal-900/20 text-teal-700" },
                  { label: "Tarefas", icon: CheckSquare, href: "/ProductivityKanban", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-700" },
                  { label: "Avisos", icon: Bell, href: "/ProductivityNotices", color: "bg-amber-50 dark:bg-amber-900/20 text-amber-700" },
                  ...(isAdmin ? [
                    { label: "Gestor", icon: TrendingUp, href: "/ProductivityManager", color: "bg-green-50 dark:bg-green-900/20 text-green-700" }
                  ] : []),
                ].map(item => (
                  <Link key={item.label} to={item.href} className={`${item.color} rounded-xl p-3 flex items-center gap-2 hover:opacity-80 transition-opacity`}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}