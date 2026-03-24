import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, AlertTriangle, Activity, BookOpen, BarChart3,
  FileText, Upload, CheckCircle2, XCircle, Clock, TrendingUp,
  Users, Building2, Calendar, Loader2
} from "lucide-react";
import NR01UploadFlow from "@/components/nr01/NR01UploadFlow";
import NR01ActionPlan from "@/components/nr01/NR01ActionPlan";
import NR01Exams from "@/components/nr01/NR01Exams";
import NR01Risks from "@/components/nr01/NR01Risks";
import NR01Trainings from "@/components/nr01/NR01Trainings";
import NR01Tasks from "@/components/nr01/NR01Tasks";
import { differenceInDays, format, isBefore } from "date-fns";
import { toast } from "sonner";

export default function NR01Module() {
  const [user, setUser] = useState(null);
  const [selectedContract, setSelectedContract] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list(), enabled: !!user
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), enabled: !!user
  });
  const { data: programs = [] } = useQuery({
    queryKey: ["safety_programs"], queryFn: () => base44.entities.ContractSafetyProgram.list(), enabled: !!user
  });
  const { data: risks = [] } = useQuery({
    queryKey: ["risks"], queryFn: () => base44.entities.RiskInventory.list(), enabled: !!user
  });
  const { data: actions = [] } = useQuery({
    queryKey: ["actions"], queryFn: () => base44.entities.RiskActionPlan.list(), enabled: !!user
  });
  const { data: healthPlans = [] } = useQuery({
    queryKey: ["health_plans"], queryFn: () => base44.entities.HealthActivityPlan.list(), enabled: !!user
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees_safety"], queryFn: () => base44.entities.Employee.list(), enabled: !!user
  });
  const { data: exams = [] } = useQuery({
    queryKey: ["sst_exames"], queryFn: () => base44.entities.SSTExame.list(), enabled: !!user
  });
  const { data: trainings = [] } = useQuery({
    queryKey: ["sst_treinamentos"], queryFn: () => base44.entities.SSTTreinamento.list(), enabled: !!user
  });
  const { data: nr01Tasks = [] } = useQuery({
    queryKey: ["nr01_tasks"], queryFn: () => base44.entities.TarefaNR01.list(), enabled: !!user
  });

  const getContractLabel = (cid) => {
    const c = contracts.find(x => x.id === cid);
    if (!c) return "—";
    const cl = clients.find(x => x.id === c.client_id);
    return `${c.contract_number} — ${cl?.name || ""}`;
  };

  // Dados filtrados pelo contrato selecionado
  const filteredRisks = selectedContract ? risks.filter(r => r.contract_id === selectedContract) : risks;
  const filteredActions = selectedContract ? actions.filter(a => a.company_id === user?.company_id) : actions;
  const filteredPlans = selectedContract ? healthPlans.filter(h => h.contract_id === selectedContract) : healthPlans;
  const filteredExams = selectedContract ? exams.filter(e => e.contract_id === selectedContract) : exams;
  const filteredTrainings = selectedContract ? trainings.filter(t => t.contract_id === selectedContract) : trainings;
  const filteredTasks = selectedContract ? nr01Tasks.filter(t => t.contract_id === selectedContract) : nr01Tasks;

  const program = programs.find(p => p.contract_id === selectedContract);

  // KPIs
  const totalActions = filteredActions.length;
  const concludedActions = filteredActions.filter(a => a.status === "concluido").length;
  const overdueActions = filteredActions.filter(a => a.status !== "concluido" && a.deadline && isBefore(new Date(a.deadline), new Date())).length;
  const pctActions = totalActions > 0 ? Math.round((concludedActions / totalActions) * 100) : 0;

  const criticalRisks = filteredRisks.filter(r => r.risk_level === "critico" || r.risk_level === "alto");
  const pendingTasks = filteredTasks.filter(t => t.status !== "concluida" && t.status !== "cancelada").length;

  const overdueExams = filteredExams.filter(e => e.status === "vencido").length;
  const upcomingExams = filteredExams.filter(e => e.status === "agendado").length;

  const pgrDays = program?.pgr_validity ? differenceInDays(new Date(program.pgr_validity), new Date()) : null;
  const pcmsoDays = program?.pcmso_validity ? differenceInDays(new Date(program.pcmso_validity), new Date()) : null;

  const getDocBadge = (days) => {
    if (days === null) return <Badge variant="outline">Sem data</Badge>;
    if (days < 0) return <Badge className="bg-red-100 text-red-800">Vencido há {Math.abs(days)}d</Badge>;
    if (days <= 30) return <Badge className="bg-red-100 text-red-800">{days} dias</Badge>;
    if (days <= 90) return <Badge className="bg-yellow-100 text-yellow-800">{days} dias</Badge>;
    return <Badge className="bg-green-100 text-green-800">{days} dias</Badge>;
  };

  const alerts = [];
  if (pgrDays !== null && pgrDays <= 90) alerts.push({ msg: `PGR vence em ${pgrDays} dias`, level: pgrDays <= 30 ? "critico" : "atencao" });
  if (pcmsoDays !== null && pcmsoDays <= 90) alerts.push({ msg: `PCMSO vence em ${pcmsoDays} dias`, level: pcmsoDays <= 30 ? "critico" : "atencao" });
  if (overdueActions > 0) alerts.push({ msg: `${overdueActions} ação(ões) do plano em atraso`, level: "critico" });
  if (criticalRisks.length > 0) alerts.push({ msg: `${criticalRisks.length} risco(s) alto/crítico sem controle confirmado`, level: "critico" });
  if (overdueExams > 0) alerts.push({ msg: `${overdueExams} exame(s) médico(s) vencidos`, level: "critico" });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gestão NR-01</h1>
              <p className="text-xs text-gray-500">PGR · PCMSO · Conformidade</p>
            </div>
          </div>

          {/* Seletor de contrato */}
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-gray-400" />
            <Select value={selectedContract} onValueChange={setSelectedContract}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecionar contrato/programa..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos os contratos</SelectItem>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{getContractLabel(c.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setActiveTab("upload")}>
              <Upload className="w-4 h-4" /> Novo Programa
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap gap-1 h-auto bg-white border rounded-lg p-1 shadow-sm">
            <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="w-4 h-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="upload" className="gap-2"><Upload className="w-4 h-4" />Upload / Programas</TabsTrigger>
            <TabsTrigger value="actions" className="gap-2"><CheckCircle2 className="w-4 h-4" />Plano de Ação</TabsTrigger>
            <TabsTrigger value="exams" className="gap-2"><Activity className="w-4 h-4" />Exames (PCMSO)</TabsTrigger>
            <TabsTrigger value="risks" className="gap-2"><AlertTriangle className="w-4 h-4" />Inventário de Riscos</TabsTrigger>
            <TabsTrigger value="trainings" className="gap-2"><BookOpen className="w-4 h-4" />Treinamentos</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2 relative">
              <CheckCircle2 className="w-4 h-4" />Tarefas NR-01
              {pendingTasks > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{pendingTasks > 9 ? '9+' : pendingTasks}</span>}
            </TabsTrigger>
          </TabsList>

          {/* ─── DASHBOARD ─── */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-medium">Plano de Ação</span>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{pctActions}%</div>
                  <div className="text-xs text-gray-500">{concludedActions}/{totalActions} concluídas</div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pctActions}%` }} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-medium">Ações em Atraso</span>
                    <XCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className={`text-2xl font-bold ${overdueActions > 0 ? "text-red-600" : "text-green-600"}`}>{overdueActions}</div>
                  <div className="text-xs text-gray-500">de {totalActions} ações</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-medium">Riscos Críticos</span>
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className={`text-2xl font-bold ${criticalRisks.length > 0 ? "text-orange-600" : "text-green-600"}`}>{criticalRisks.length}</div>
                  <div className="text-xs text-gray-500">alto + crítico</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-medium">Exames Vencidos</span>
                    <Activity className="w-4 h-4 text-red-500" />
                  </div>
                  <div className={`text-2xl font-bold ${overdueExams > 0 ? "text-red-600" : "text-green-600"}`}>{overdueExams}</div>
                  <div className="text-xs text-gray-500">{upcomingExams} agendados</div>
                </CardContent>
              </Card>
            </div>

            {/* Validade dos documentos */}
            {selectedContract && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Validade do PGR</p>
                      <p className="text-xs text-gray-400">{program?.pgr_validity ? format(new Date(program.pgr_validity), "dd/MM/yyyy") : "Não informado"}</p>
                    </div>
                    {getDocBadge(pgrDays)}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Validade do PCMSO</p>
                      <p className="text-xs text-gray-400">{program?.pcmso_validity ? format(new Date(program.pcmso_validity), "dd/MM/yyyy") : "Não informado"}</p>
                    </div>
                    {getDocBadge(pcmsoDays)}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Alertas críticos */}
            {alerts.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Alertas Críticos ({alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {alerts.map((a, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${a.level === "critico" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {a.msg}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {alerts.length === 0 && totalActions > 0 && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">Nenhum alerta crítico. Sistema em conformidade!</span>
              </div>
            )}

            {/* Resumo por contrato */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Programas Cadastrados</CardTitle></CardHeader>
              <CardContent>
                {programs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Nenhum programa cadastrado ainda.</p>
                    <Button className="mt-3 gap-2" size="sm" onClick={() => setActiveTab("upload")}>
                      <Upload className="w-4 h-4" /> Cadastrar primeiro programa
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {programs.map(p => {
                      const pgr = p.pgr_validity ? differenceInDays(new Date(p.pgr_validity), new Date()) : null;
                      const pcmso = p.pcmso_validity ? differenceInDays(new Date(p.pcmso_validity), new Date()) : null;
                      const pActions = actions.filter(a => a.company_id === p.company_id);
                      const pConcluded = pActions.filter(a => a.status === "concluido").length;
                      const pct = pActions.length > 0 ? Math.round((pConcluded / pActions.length) * 100) : 0;
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedContract(p.contract_id); setActiveTab("dashboard"); }}>
                          <div>
                            <p className="font-medium text-sm">{getContractLabel(p.contract_id)}</p>
                            <p className="text-xs text-gray-400">{p.safety_manager || "Responsável não informado"}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Plano: {pct}%</p>
                              <div className="flex gap-1 mt-1">
                                {p.pgr_file_url && <Badge variant="outline" className="text-xs py-0">PGR</Badge>}
                                {p.pcmso_file_url && <Badge variant="outline" className="text-xs py-0">PCMSO</Badge>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── UPLOAD / PROGRAMAS ─── */}
          <TabsContent value="upload">
            <NR01UploadFlow
              user={user}
              contracts={contracts}
              clients={clients}
              programs={programs}
              onProgramSaved={(contractId) => {
                setSelectedContract(contractId);
                setActiveTab("dashboard");
              }}
            />
          </TabsContent>

          {/* ─── PLANO DE AÇÃO ─── */}
          <TabsContent value="actions">
            <NR01ActionPlan
              user={user}
              actions={filteredActions}
              risks={filteredRisks}
              contracts={contracts}
              clients={clients}
              selectedContract={selectedContract}
            />
          </TabsContent>

          {/* ─── EXAMES ─── */}
          <TabsContent value="exams">
            <NR01Exams
              user={user}
              healthPlans={filteredPlans}
              exams={filteredExams}
              employees={employees}
              contracts={contracts}
              clients={clients}
              selectedContract={selectedContract}
            />
          </TabsContent>

          {/* ─── RISCOS ─── */}
          <TabsContent value="risks">
            <NR01Risks
              user={user}
              risks={filteredRisks}
              contracts={contracts}
              clients={clients}
              selectedContract={selectedContract}
            />
          </TabsContent>

          {/* ─── TREINAMENTOS ─── */}
          <TabsContent value="trainings">
            <NR01Trainings
              user={user}
              trainings={filteredTrainings}
              employees={employees}
              contracts={contracts}
              clients={clients}
              selectedContract={selectedContract}
            />
          </TabsContent>

          {/* ─── TAREFAS NR-01 ─── */}
          <TabsContent value="tasks">
            <NR01Tasks
              user={user}
              tasks={filteredTasks}
              selectedContract={selectedContract}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}