import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Filter } from "lucide-react";
import { format, isBefore } from "date-fns";

const RISK_TYPE_LABELS = { fisico: "Físico", quimico: "Químico", biologico: "Biológico", ergonomico: "Ergonômico", acidente: "Acidente" };
const RISK_LEVEL_COLORS = { baixo: "bg-green-100 text-green-800", medio: "bg-yellow-100 text-yellow-800", alto: "bg-orange-100 text-orange-800", critico: "bg-red-100 text-red-800" };
const RISK_LEVEL_LABELS = { baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico" };
const ACT_TYPE_LABELS = { admissional: "Admissional", periodico: "Periódico", demissional: "Demissional", treinamento: "Treinamento", avaliacao_medica: "Avaliação Médica" };
const EMP_STATUS_LABELS = { pendente: "Pendente", agendado: "Agendado", realizado: "Realizado", vencido: "Vencido" };
const EMP_STATUS_COLORS = { pendente: "bg-gray-100 text-gray-700", agendado: "bg-blue-100 text-blue-700", realizado: "bg-green-100 text-green-700", vencido: "bg-red-100 text-red-700" };
const STATUS_COLORS = { pendente: "bg-gray-100 text-gray-800", em_andamento: "bg-blue-100 text-blue-800", concluido: "bg-green-100 text-green-800" };
const STATUS_LABELS = { pendente: "Pendente", em_andamento: "Em Andamento", concluido: "Concluído" };

export default function SafetyReports() {
  const [user, setUser] = useState(null);
  const [filterContract, setFilterContract] = useState("");
  const [filterClient, setFilterClient] = useState("");

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: risks = [] } = useQuery({ queryKey: ["risks"], queryFn: () => base44.entities.RiskInventory.list(), enabled: !!user });
  const { data: actions = [] } = useQuery({ queryKey: ["actions"], queryFn: () => base44.entities.RiskActionPlan.list(), enabled: !!user });
  const { data: empActivities = [] } = useQuery({ queryKey: ["emp_activities"], queryFn: () => base44.entities.EmployeeSafetyActivity.list(), enabled: !!user });
  const { data: plans = [] } = useQuery({ queryKey: ["health_plans"], queryFn: () => base44.entities.HealthActivityPlan.list(), enabled: !!user });
  const { data: programs = [] } = useQuery({ queryKey: ["safety_programs"], queryFn: () => base44.entities.ContractSafetyProgram.list(), enabled: !!user });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list(), enabled: !!user });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), enabled: !!user });
  const { data: employees = [] } = useQuery({ queryKey: ["employees_safety"], queryFn: () => base44.entities.Employee.list(), enabled: !!user });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: () => base44.entities.Department.list(), enabled: !!user });

  const getContractLabel = (cid) => { const c = contracts.find(x => x.id === cid); if (!c) return "—"; const cl = clients.find(x => x.id === c.client_id); return `${c.contract_number} — ${cl?.name || ""}`; };
  const getEmployeeName = (eid) => employees.find(e => e.id === eid)?.full_name || "—";
  const getPlanName = (pid) => { const p = plans.find(x => x.id === pid); return p ? p.activity_name : "—"; };
  const getDeptName = (did) => departments.find(d => d.id === did)?.name || "—";
  const getStatusBadge = (dateStr) => {
    if (!dateStr) return <Badge variant="outline">Sem data</Badge>;
    if (isBefore(new Date(dateStr), new Date())) return <Badge variant="destructive">Vencido</Badge>;
    return <Badge className="bg-green-100 text-green-800">Válido</Badge>;
  };

  const filteredContracts = contracts.filter(c => {
    if (filterClient && c.client_id !== filterClient) return false;
    if (filterContract && c.id !== filterContract) return false;
    return true;
  });

  const filteredRisks = risks.filter(r => {
    if (filterContract && r.contract_id !== filterContract) return false;
    if (filterClient) { const c = contracts.find(x => x.id === r.contract_id); if (!c || c.client_id !== filterClient) return false; }
    return true;
  });

  const filteredActions = actions.filter(a => {
    if (!filterContract && !filterClient) return true;
    const risk = risks.find(r => r.id === a.risk_id);
    if (!risk) return false;
    if (filterContract && risk.contract_id !== filterContract) return false;
    if (filterClient) { const c = contracts.find(x => x.id === risk.contract_id); if (!c || c.client_id !== filterClient) return false; }
    return true;
  });

  const filteredEmpActivities = empActivities.filter(a => {
    if (filterContract && a.contract_id !== filterContract) return false;
    if (filterClient) { const c = contracts.find(x => x.id === a.contract_id); if (!c || c.client_id !== filterClient) return false; }
    return true;
  });

  const overdueEmpActivities = filteredEmpActivities.filter(a => a.status === "vencido" || (a.scheduled_date && isBefore(new Date(a.scheduled_date), new Date()) && a.status !== "realizado"));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios de Segurança</h1>
          <p className="text-gray-500 text-sm">NR-01 / GRO — PGR e PCMSO</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Filter className="w-4 h-4 text-gray-400" />
            <div>
              <Label className="text-xs">Cliente</Label>
              <select className="block border rounded-md px-3 py-2 text-sm min-w-[200px]" value={filterClient} onChange={e => { setFilterClient(e.target.value); setFilterContract(""); }}>
                <option value="">Todos</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Contrato</Label>
              <select className="block border rounded-md px-3 py-2 text-sm min-w-[240px]" value={filterContract} onChange={e => setFilterContract(e.target.value)}>
                <option value="">Todos</option>
                {(filterClient ? contracts.filter(c => c.client_id === filterClient) : contracts).map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
              </select>
            </div>
            {(filterClient || filterContract) && (
              <Button variant="outline" size="sm" onClick={() => { setFilterClient(""); setFilterContract(""); }}>Limpar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="compliance">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="compliance">Conformidade por Contrato</TabsTrigger>
          <TabsTrigger value="risks">Inventário de Riscos</TabsTrigger>
          <TabsTrigger value="actions">Plano de Ação</TabsTrigger>
          <TabsTrigger value="activities">PCMSO por Colaborador</TabsTrigger>
          <TabsTrigger value="overdue">Atividades Vencidas</TabsTrigger>
        </TabsList>

        {/* Conformidade */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader><CardTitle className="text-sm">Status de Conformidade por Contrato</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>PGR</TableHead>
                    <TableHead>PCMSO</TableHead>
                    <TableHead>Riscos</TableHead>
                    <TableHead>Atividades</TableHead>
                    <TableHead>Vencidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-6">Nenhum contrato</TableCell></TableRow>}
                  {filteredContracts.map(c => {
                    const prog = programs.find(p => p.contract_id === c.id);
                    const contractRisks = risks.filter(r => r.contract_id === c.id);
                    const contractActivities = empActivities.filter(a => a.contract_id === c.id);
                    const contractOverdue = contractActivities.filter(a => a.status === "vencido" || (a.scheduled_date && isBefore(new Date(a.scheduled_date), new Date()) && a.status !== "realizado"));
                    const cl = clients.find(x => x.id === c.client_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.contract_number}</TableCell>
                        <TableCell>{cl?.name || "—"}</TableCell>
                        <TableCell>{prog ? getStatusBadge(prog.pgr_validity) : <Badge variant="outline">Sem PGR</Badge>}</TableCell>
                        <TableCell>{prog ? getStatusBadge(prog.pcmso_validity) : <Badge variant="outline">Sem PCMSO</Badge>}</TableCell>
                        <TableCell>{contractRisks.length}</TableCell>
                        <TableCell>{contractActivities.length}</TableCell>
                        <TableCell>{contractOverdue.length > 0 ? <Badge variant="destructive">{contractOverdue.length} vencida(s)</Badge> : <Badge className="bg-green-100 text-green-800">OK</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventário */}
        <TabsContent value="risks">
          <Card>
            <CardHeader><CardTitle className="text-sm">Inventário de Riscos ({filteredRisks.length} riscos)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risco</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Probabilidade</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Medidas</TableHead>
                    <TableHead>Contrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRisks.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-6">Nenhum risco</TableCell></TableRow>}
                  {filteredRisks.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.risk_name}</TableCell>
                      <TableCell>{RISK_TYPE_LABELS[r.risk_type]}</TableCell>
                      <TableCell><Badge className={RISK_LEVEL_COLORS[r.risk_level]}>{RISK_LEVEL_LABELS[r.risk_level]}</Badge></TableCell>
                      <TableCell className="capitalize text-sm">{r.probability || "—"}</TableCell>
                      <TableCell className="capitalize text-sm">{r.severity || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{r.control_measures || "—"}</TableCell>
                      <TableCell className="text-sm">{getContractLabel(r.contract_id)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plano de ação */}
        <TabsContent value="actions">
          <Card>
            <CardHeader><CardTitle className="text-sm">Plano de Ação ({filteredActions.length} ações)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActions.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-6">Nenhuma ação</TableCell></TableRow>}
                  {filteredActions.map(a => {
                    const risk = risks.find(r => r.id === a.risk_id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{a.action_description}</TableCell>
                        <TableCell className="text-sm">{risk?.risk_name || "—"}</TableCell>
                        <TableCell className="text-sm">{a.responsible}</TableCell>
                        <TableCell className="text-sm">{a.deadline ? format(new Date(a.deadline), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell><Badge className={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PCMSO por colaborador */}
        <TabsContent value="activities">
          <Card>
            <CardHeader><CardTitle className="text-sm">PCMSO por Colaborador</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Data Prevista</TableHead>
                    <TableHead>Realização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmpActivities.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-6">Nenhuma atividade</TableCell></TableRow>}
                  {filteredEmpActivities.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{getEmployeeName(a.employee_id)}</TableCell>
                      <TableCell className="text-sm">{getPlanName(a.activity_id)}</TableCell>
                      <TableCell className="text-sm">{a.scheduled_date ? format(new Date(a.scheduled_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm">{a.completion_date ? format(new Date(a.completion_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell><Badge className={EMP_STATUS_COLORS[a.status]}>{EMP_STATUS_LABELS[a.status]}</Badge></TableCell>
                      <TableCell className="text-sm">{getContractLabel(a.contract_id)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vencidas */}
        <TabsContent value="overdue">
          <Card className={overdueEmpActivities.length > 0 ? "border-red-200" : ""}>
            <CardHeader>
              <CardTitle className={`text-sm ${overdueEmpActivities.length > 0 ? "text-red-700" : ""}`}>
                Atividades Vencidas ({overdueEmpActivities.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Data Prevista</TableHead>
                    <TableHead>Dias em Atraso</TableHead>
                    <TableHead>Contrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueEmpActivities.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-green-600 py-6">✓ Nenhuma atividade vencida!</TableCell></TableRow>}
                  {overdueEmpActivities.map(a => {
                    const days = a.scheduled_date ? Math.floor((new Date() - new Date(a.scheduled_date)) / (1000*60*60*24)) : 0;
                    return (
                      <TableRow key={a.id} className="bg-red-50">
                        <TableCell className="font-medium text-sm">{getEmployeeName(a.employee_id)}</TableCell>
                        <TableCell className="text-sm">{getPlanName(a.activity_id)}</TableCell>
                        <TableCell className="text-sm text-red-600">{a.scheduled_date ? format(new Date(a.scheduled_date), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell><Badge variant="destructive">{days} dia(s)</Badge></TableCell>
                        <TableCell className="text-sm">{getContractLabel(a.contract_id)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}