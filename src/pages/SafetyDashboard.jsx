import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Activity, Users, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const RISK_COLORS = { fisico: "#3b82f6", quimico: "#8b5cf6", biologico: "#10b981", ergonomico: "#f59e0b", acidente: "#ef4444" };
const RISK_LABELS = { fisico: "Físico", quimico: "Químico", biologico: "Biológico", ergonomico: "Ergonômico", acidente: "Acidente" };
const LEVEL_COLORS = { baixo: "#10b981", medio: "#f59e0b", alto: "#f97316", critico: "#ef4444" };

export default function SafetyDashboard() {
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: risks = [] } = useQuery({ queryKey: ["risks"], queryFn: () => base44.entities.RiskInventory.list(), enabled: !!user });
  const { data: actions = [] } = useQuery({ queryKey: ["actions"], queryFn: () => base44.entities.RiskActionPlan.list(), enabled: !!user });
  const { data: activities = [] } = useQuery({ queryKey: ["emp_activities"], queryFn: () => base44.entities.EmployeeSafetyActivity.list(), enabled: !!user });
  const { data: programs = [] } = useQuery({ queryKey: ["safety_programs"], queryFn: () => base44.entities.ContractSafetyProgram.list(), enabled: !!user });
  const { data: employees = [] } = useQuery({ queryKey: ["employees_safety"], queryFn: () => base44.entities.Employee.list(), enabled: !!user });

  const today = new Date();
  const in30Days = addDays(today, 30);

  const pendingActivities = activities.filter(a => a.status === "pendente" || a.status === "agendado");
  const overdueActivities = activities.filter(a => a.status === "vencido" || (a.scheduled_date && isBefore(new Date(a.scheduled_date), today) && a.status !== "realizado"));
  const nearDuePrograms = programs.filter(p =>
    (p.pgr_validity && isBefore(new Date(p.pgr_validity), in30Days)) ||
    (p.pcmso_validity && isBefore(new Date(p.pcmso_validity), in30Days))
  );

  const risksByType = Object.entries(RISK_LABELS).map(([key, label]) => ({
    name: label,
    value: risks.filter(r => r.risk_type === key).length,
    color: RISK_COLORS[key]
  })).filter(r => r.value > 0);

  const risksByLevel = [
    { name: "Baixo", value: risks.filter(r => r.risk_level === "baixo").length, color: LEVEL_COLORS.baixo },
    { name: "Médio", value: risks.filter(r => r.risk_level === "medio").length, color: LEVEL_COLORS.medio },
    { name: "Alto", value: risks.filter(r => r.risk_level === "alto").length, color: LEVEL_COLORS.alto },
    { name: "Crítico", value: risks.filter(r => r.risk_level === "critico").length, color: LEVEL_COLORS.critico },
  ].filter(r => r.value > 0);

  const actionsByStatus = [
    { name: "Pendente", value: actions.filter(a => a.status === "pendente").length },
    { name: "Em Andamento", value: actions.filter(a => a.status === "em_andamento").length },
    { name: "Concluído", value: actions.filter(a => a.status === "concluido").length },
  ];

  const statsCards = [
    { title: "Funcionários Monitorados", value: employees.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Riscos Mapeados", value: risks.length, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
    { title: "Atividades Pendentes", value: pendingActivities.length, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { title: "Atividades Vencidas", value: overdueActivities.length, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { title: "Planos de Ação", value: actions.length, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Ações Concluídas", value: actions.filter(a => a.status === "concluido").length, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Segurança do Trabalho</h1>
          <p className="text-gray-500 text-sm">Visão geral — NR-01 / GRO</p>
        </div>
      </div>

      {/* Alertas */}
      {(overdueActivities.length > 0 || nearDuePrograms.length > 0) && (
        <div className="space-y-2">
          {overdueActivities.length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-700 font-medium">{overdueActivities.length} atividade(s) de saúde vencida(s) — ação imediata necessária!</span>
            </div>
          )}
          {nearDuePrograms.length > 0 && (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <span className="text-yellow-700 font-medium">{nearDuePrograms.length} programa(s) (PGR/PCMSO) com validade próxima do vencimento (30 dias).</span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsCards.map((card) => (
          <Card key={card.title} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500 mt-1">{card.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Riscos por Tipo</CardTitle></CardHeader>
          <CardContent>
            {risksByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={risksByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {risksByType.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Nenhum risco cadastrado</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Riscos por Nível</CardTitle></CardHeader>
          <CardContent>
            {risksByLevel.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={risksByLevel}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Riscos">
                    {risksByLevel.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Nenhum risco cadastrado</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Status dos Planos de Ação</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={actionsByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="Ações" fill="#8b5cf6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Últimas atividades vencidas */}
      {overdueActivities.length > 0 && (
        <Card className="border-red-100">
          <CardHeader>
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Atividades Vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueActivities.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between bg-red-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-gray-700">{a.observations || "Atividade de saúde"}</span>
                  <div className="flex items-center gap-2">
                    {a.scheduled_date && <span className="text-xs text-red-600">Prevista: {format(new Date(a.scheduled_date), "dd/MM/yyyy")}</span>}
                    <Badge variant="destructive">Vencida</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}