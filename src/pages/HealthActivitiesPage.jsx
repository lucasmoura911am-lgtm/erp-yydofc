import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus, Edit, Trash2, UserPlus, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, addDays } from "date-fns";

const ACT_TYPE_LABELS = { admissional: "Admissional", periodico: "Periódico", demissional: "Demissional", treinamento: "Treinamento", avaliacao_medica: "Avaliação Médica" };
const ACT_TYPE_COLORS = { admissional: "bg-blue-100 text-blue-800", periodico: "bg-purple-100 text-purple-800", demissional: "bg-gray-100 text-gray-800", treinamento: "bg-green-100 text-green-800", avaliacao_medica: "bg-pink-100 text-pink-800" };
const FREQ_LABELS = { unico: "Único", mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };
const EMP_STATUS_COLORS = { pendente: "bg-gray-100 text-gray-700", agendado: "bg-blue-100 text-blue-700", realizado: "bg-green-100 text-green-700", vencido: "bg-red-100 text-red-700" };
const EMP_STATUS_LABELS = { pendente: "Pendente", agendado: "Agendado", realizado: "Realizado", vencido: "Vencido" };

const emptyPlan = { contract_id: "", activity_name: "", activity_type: "", frequency: "anual", description: "" };
const emptyAssign = { employee_id: "", activity_id: "", contract_id: "", scheduled_date: "", status: "pendente", observations: "" };

export default function HealthActivitiesPage() {
  const [user, setUser] = useState(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingAssign, setEditingAssign] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [assignForm, setAssignForm] = useState(emptyAssign);
  const [selectedContract, setSelectedContract] = useState("");

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();

  const { data: plans = [] } = useQuery({ queryKey: ["health_plans"], queryFn: () => base44.entities.HealthActivityPlan.list(), enabled: !!user });
  const { data: empActivities = [] } = useQuery({ queryKey: ["emp_activities"], queryFn: () => base44.entities.EmployeeSafetyActivity.list(), enabled: !!user });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list(), enabled: !!user });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), enabled: !!user });
  const { data: employees = [] } = useQuery({ queryKey: ["employees_safety"], queryFn: () => base44.entities.Employee.list(), enabled: !!user });
  const { data: allocations = [] } = useQuery({ queryKey: ["allocations"], queryFn: () => base44.entities.Allocation.list(), enabled: !!user });

  const savePlanMutation = useMutation({
    mutationFn: (data) => editingPlan ? base44.entities.HealthActivityPlan.update(editingPlan.id, data) : base44.entities.HealthActivityPlan.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { qc.invalidateQueries(["health_plans"]); toast.success("Atividade salva!"); resetPlanForm(); }
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id) => base44.entities.HealthActivityPlan.delete(id),
    onSuccess: () => { qc.invalidateQueries(["health_plans"]); toast.success("Removido!"); }
  });

  const saveAssignMutation = useMutation({
    mutationFn: (data) => editingAssign ? base44.entities.EmployeeSafetyActivity.update(editingAssign.id, data) : base44.entities.EmployeeSafetyActivity.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { qc.invalidateQueries(["emp_activities"]); toast.success("Atividade atribuída!"); resetAssignForm(); }
  });

  const deleteAssignMutation = useMutation({
    mutationFn: (id) => base44.entities.EmployeeSafetyActivity.delete(id),
    onSuccess: () => { qc.invalidateQueries(["emp_activities"]); toast.success("Removido!"); }
  });

  const resetPlanForm = () => { setPlanForm(emptyPlan); setEditingPlan(null); setPlanDialogOpen(false); };
  const resetAssignForm = () => { setAssignForm(emptyAssign); setEditingAssign(null); setAssignDialogOpen(false); };

  const handleEditPlan = (p) => { setEditingPlan(p); setPlanForm({ contract_id: p.contract_id, activity_name: p.activity_name, activity_type: p.activity_type, frequency: p.frequency, description: p.description || "" }); setPlanDialogOpen(true); };
  const handleEditAssign = (a) => { setEditingAssign(a); setAssignForm({ employee_id: a.employee_id, activity_id: a.activity_id, contract_id: a.contract_id, scheduled_date: a.scheduled_date || "", status: a.status, observations: a.observations || "" }); setAssignDialogOpen(true); };

  const getContractLabel = (cid) => { const c = contracts.find(x => x.id === cid); if (!c) return "—"; const cl = clients.find(x => x.id === c.client_id); return `${c.contract_number} — ${cl?.name || ""}`; };
  const getEmployeeName = (eid) => employees.find(e => e.id === eid)?.full_name || "—";
  const getPlanName = (pid) => { const p = plans.find(x => x.id === pid); return p ? `${p.activity_name} (${ACT_TYPE_LABELS[p.activity_type]})` : "—"; };

  // Funcionários por contrato
  const getEmployeesForContract = (contractId) => {
    const contractAllocations = allocations.filter(a => a.contract_id === contractId && a.status === "ativo");
    return employees.filter(e => contractAllocations.some(a => a.employee_id === e.id));
  };

  const filteredPlans = selectedContract ? plans.filter(p => p.contract_id === selectedContract) : plans;
  const filteredEmpActivities = selectedContract ? empActivities.filter(a => a.contract_id === selectedContract) : empActivities;

  const isOverdue = (a) => a.scheduled_date && isBefore(new Date(a.scheduled_date), new Date()) && a.status !== "realizado";

  const sp = (k, v) => setPlanForm(f => ({ ...f, [k]: v }));
  const sa = (k, v) => setAssignForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atividades de Saúde (PCMSO)</h1>
          <p className="text-gray-500 text-sm">Plano de atividades e acompanhamento por colaborador</p>
        </div>
      </div>

      {/* Filtro por contrato */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <Label className="whitespace-nowrap">Filtrar por contrato:</Label>
            <select className="border rounded-md px-3 py-2 text-sm min-w-[280px]" value={selectedContract} onChange={e => setSelectedContract(e.target.value)}>
              <option value="">Todos</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plano de Atividades</TabsTrigger>
          <TabsTrigger value="employees">Atividades por Colaborador</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setPlanDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Atividade</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nenhuma atividade cadastrada</TableCell></TableRow>}
                  {filteredPlans.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.activity_name}</div>
                        {p.description && <div className="text-xs text-gray-400">{p.description}</div>}
                      </TableCell>
                      <TableCell><Badge className={ACT_TYPE_COLORS[p.activity_type]}>{ACT_TYPE_LABELS[p.activity_type]}</Badge></TableCell>
                      <TableCell className="text-sm">{FREQ_LABELS[p.frequency]}</TableCell>
                      <TableCell className="text-sm">{getContractLabel(p.contract_id)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditPlan(p)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir atividade?")) deletePlanMutation.mutate(p.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAssignDialogOpen(true)} className="gap-2"><UserPlus className="w-4 h-4" /> Atribuir Atividade</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Data Prevista</TableHead>
                    <TableHead>Realização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmpActivities.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Nenhuma atividade atribuída</TableCell></TableRow>}
                  {filteredEmpActivities.map(a => (
                    <TableRow key={a.id} className={isOverdue(a) ? "bg-red-50" : ""}>
                      <TableCell className="font-medium text-sm">{getEmployeeName(a.employee_id)}</TableCell>
                      <TableCell className="text-sm">{getPlanName(a.activity_id)}</TableCell>
                      <TableCell className={`text-sm ${isOverdue(a) ? "text-red-600 font-medium" : ""}`}>
                        {a.scheduled_date ? format(new Date(a.scheduled_date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{a.completion_date ? format(new Date(a.completion_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell><Badge className={EMP_STATUS_COLORS[a.status]}>{EMP_STATUS_LABELS[a.status]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditAssign(a)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deleteAssignMutation.mutate(a.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog plano */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingPlan ? "Editar Atividade" : "Nova Atividade PCMSO"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); savePlanMutation.mutate(planForm); }} className="space-y-4">
            <div>
              <Label>Contrato *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm" value={planForm.contract_id} onChange={e => sp("contract_id", e.target.value)}>
                <option value="">Selecione...</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome da Atividade *</Label>
                <Input required value={planForm.activity_name} onChange={e => sp("activity_name", e.target.value)} />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select required value={planForm.activity_type} onValueChange={v => sp("activity_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admissional">Admissional</SelectItem>
                    <SelectItem value="periodico">Periódico</SelectItem>
                    <SelectItem value="demissional">Demissional</SelectItem>
                    <SelectItem value="treinamento">Treinamento</SelectItem>
                    <SelectItem value="avaliacao_medica">Avaliação Médica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Frequência</Label>
              <Select value={planForm.frequency} onValueChange={v => sp("frequency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unico">Único</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={planForm.description} onChange={e => sp("description", e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetPlanForm}>Cancelar</Button>
              <Button type="submit">{editingPlan ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog atribuição */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Atribuir Atividade ao Colaborador</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveAssignMutation.mutate(assignForm); }} className="space-y-4">
            <div>
              <Label>Contrato *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm" value={assignForm.contract_id} onChange={e => { sa("contract_id", e.target.value); sa("employee_id", ""); }}>
                <option value="">Selecione...</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
              </select>
            </div>
            <div>
              <Label>Colaborador *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm" value={assignForm.employee_id} onChange={e => sa("employee_id", e.target.value)}>
                <option value="">Selecione...</option>
                {(assignForm.contract_id ? getEmployeesForContract(assignForm.contract_id) : employees).map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Atividade *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm" value={assignForm.activity_id} onChange={e => sa("activity_id", e.target.value)}>
                <option value="">Selecione...</option>
                {plans.filter(p => !assignForm.contract_id || p.contract_id === assignForm.contract_id).map(p => (
                  <option key={p.id} value={p.id}>{p.activity_name} — {ACT_TYPE_LABELS[p.activity_type]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Prevista</Label>
                <Input type="date" value={assignForm.scheduled_date} onChange={e => sa("scheduled_date", e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={assignForm.status} onValueChange={v => sa("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={assignForm.observations} onChange={e => sa("observations", e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetAssignForm}>Cancelar</Button>
              <Button type="submit">Atribuir</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}