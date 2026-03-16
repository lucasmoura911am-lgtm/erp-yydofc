import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from "recharts";
import {
  Briefcase, Users, CalendarCheck, TrendingUp, Star, Clock,
  CheckCircle2, XCircle, AlertCircle, ChevronRight
} from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const STAGE_LABELS = {
  triagem: "Triagem",
  entrevista_rh: "Entrevista RH",
  entrevista_tecnica: "Entrevista Técnica",
  entrevista_gestor: "Entrevista Gestor",
  proposta: "Proposta",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  desistiu: "Desistiu"
};

const STAGE_COLORS = {
  triagem: "bg-gray-100 text-gray-700",
  entrevista_rh: "bg-blue-100 text-blue-700",
  entrevista_tecnica: "bg-purple-100 text-purple-700",
  entrevista_gestor: "bg-orange-100 text-orange-700",
  proposta: "bg-yellow-100 text-yellow-700",
  aprovado: "bg-green-100 text-green-700",
  reprovado: "bg-red-100 text-red-700",
  desistiu: "bg-gray-200 text-gray-500"
};

export default function RecruitmentOverview() {
  const [user, setUser] = useState(null);

  useEffect(() => { loadUser(); }, []);
  const loadUser = async () => { const u = await base44.auth.me(); setUser(u); };

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobPositions", user?.company_id],
    queryFn: () => base44.entities.JobPosition.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates", user?.company_id],
    queryFn: () => base44.entities.Candidate.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: interviews = [] } = useQuery({
    queryKey: ["interviews", user?.company_id],
    queryFn: () => base44.entities.Interview.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const openJobs = jobs.filter(j => j.status === "aberta");
  const activeCandidate = candidates.filter(c => !["aprovado", "reprovado", "desistiu"].includes(c.kanban_stage));
  const doneInterviews = interviews.filter(i => i.status === "realizada");
  const approved = candidates.filter(c => c.kanban_stage === "aprovado");

  // Interviews per day (last 14 days)
  const last14 = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
  const interviewsByDay = last14.map(day => {
    const dateStr = format(day, "yyyy-MM-dd");
    const count = interviews.filter(i => i.scheduled_date === dateStr && i.status === "realizada").length;
    return { date: format(day, "dd/MM", { locale: ptBR }), entrevistas: count };
  });

  // Candidates by stage
  const stageData = Object.keys(STAGE_LABELS).map(stage => ({
    stage: STAGE_LABELS[stage],
    total: candidates.filter(c => c.kanban_stage === stage).length
  })).filter(d => d.total > 0);

  // Interviews by job (top 5)
  const interviewsByJob = jobs.map(j => ({
    name: j.title.length > 20 ? j.title.substring(0, 20) + "…" : j.title,
    entrevistas: interviews.filter(i => i.job_position_id === j.id).length
  })).sort((a, b) => b.entrevistas - a.entrevistas).slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Recrutamento & Seleção</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Visão geral do processo seletivo</p>
        </div>
        <div className="flex gap-2">
          <Link to="/JobPositions">
            <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              + Nova Vaga
            </button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Vagas Abertas", value: openJobs.length, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Candidatos Ativos", value: activeCandidate.length, icon: Users, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
          { label: "Entrevistas Realizadas", value: doneInterviews.length, icon: CalendarCheck, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Aprovados", value: approved.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Entrevistas por Dia (últimos 14 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={interviewsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="entrevistas" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Entrevistas por Vaga
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={interviewsByJob} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="entrevistas" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Funnel + open jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Funil de Candidatos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(STAGE_LABELS).map(stage => {
              const count = candidates.filter(c => c.kanban_stage === stage).length;
              const max = Math.max(...Object.keys(STAGE_LABELS).map(s => candidates.filter(c => c.kanban_stage === s).length), 1);
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-gray-600 dark:text-gray-400 truncate">{STAGE_LABELS[stage]}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                      style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-6 text-xs font-semibold text-gray-700 dark:text-gray-300 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Open Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Vagas Abertas</span>
              <Link to="/JobPositions" className="text-xs text-purple-600 font-normal flex items-center gap-1 hover:underline">
                Ver todas <ChevronRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openJobs.slice(0, 6).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma vaga aberta</p>
            ) : openJobs.slice(0, 6).map(job => {
              const jobCandidates = candidates.filter(c => c.job_position_id === job.id);
              const jobInterviews = interviews.filter(i => i.job_position_id === job.id && i.status === "realizada");
              return (
                <div key={job.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{job.title}</p>
                    <p className="text-xs text-gray-500">{jobCandidates.length} candidatos · {jobInterviews.length} entrevistas</p>
                  </div>
                  <Badge className={`text-xs ${job.priority === "urgente" ? "bg-red-100 text-red-700" : job.priority === "alta" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                    {job.priority}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent interviews */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Próximas Entrevistas</span>
            <Link to="/Interviews" className="text-xs text-purple-600 font-normal flex items-center gap-1 hover:underline">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {interviews.filter(i => i.status === "agendada").slice(0, 5).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhuma entrevista agendada</p>
          ) : (
            <div className="space-y-2">
              {interviews.filter(i => i.status === "agendada").slice(0, 5).map(iv => {
                const candidate = candidates.find(c => c.id === iv.candidate_id);
                const job = jobs.find(j => j.id === iv.job_position_id);
                return (
                  <div key={iv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        {candidate?.full_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{candidate?.full_name || "N/A"}</p>
                        <p className="text-xs text-gray-500">{job?.title} · {iv.interview_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{iv.scheduled_date}</p>
                      <p className="text-xs text-gray-500">{iv.scheduled_time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}