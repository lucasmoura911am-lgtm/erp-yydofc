import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, addDays } from "date-fns";

const TIPO_LABELS = { admissional: "Admissional", periodico: "Periódico", retorno: "Retorno ao Trabalho", demissional: "Demissional", mudanca_funcao: "Mudança de Função" };
const TIPO_COLORS = { admissional: "bg-blue-100 text-blue-800", periodico: "bg-purple-100 text-purple-800", retorno: "bg-yellow-100 text-yellow-800", demissional: "bg-gray-100 text-gray-800", mudanca_funcao: "bg-teal-100 text-teal-800" };
const RESULTADO_COLORS = { apto: "bg-green-100 text-green-800", inapto: "bg-red-100 text-red-800", apto_com_restricoes: "bg-yellow-100 text-yellow-800", pendente: "bg-gray-100 text-gray-700" };
const RESULTADO_LABELS = { apto: "Apto", inapto: "Inapto", apto_com_restricoes: "Apto c/ Restrições", pendente: "Pendente" };
const STATUS_COLORS = { pendente: "bg-gray-100 text-gray-700", realizado: "bg-green-100 text-green-800", vencido: "bg-red-100 text-red-800", agendado: "bg-blue-100 text-blue-800" };
const STATUS_LABELS = { pendente: "Pendente", realizado: "Realizado", vencido: "Vencido", agendado: "Agendado" };

const emptyForm = { employee_id: "", contract_id: "", tipo: "", exam_name: "", esocial_code: "", exam_date: "", due_date: "", resultado: "pendente", status: "pendente", medico_responsavel: "", crm_medico: "", observations: "" };

export default function SSTExames() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterContract, setFilterContract] = useState("");
  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();

  const { data: exames = [] } = useQuery({ queryKey: ["sst_exames"], queryFn: () => base44.entities.SSTExame.list("-created_date"), enabled: !!user });
  const { data: employees = [] } = useQuery({ queryKey: ["employees_sst"], queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }), enabled: !!user?.company_id });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list(), enabled: !!user });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), enabled: !!user });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.SSTExame.update(editing.id, data) : base44.entities.SSTExame.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { qc.invalidateQueries(["sst_exames"]); toast.success("Exame salvo!"); resetForm(); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SSTExame.delete(id),
    onSuccess: () => { qc.invalidateQueries(["sst_exames"]); toast.success("Removido!"); }
  });

  const resetForm = () => { setFormData(emptyForm); setEditing(null); setDialogOpen(false); };
  const handleEdit = (e) => { setEditing(e); setFormData({ employee_id: e.employee_id, contract_id: e.contract_id || "", tipo: e.tipo, exam_name: e.exam_name, esocial_code: e.esocial_code || "", exam_date: e.exam_date || "", due_date: e.due_date || "", resultado: e.resultado || "pendente", status: e.status || "pendente", medico_responsavel: e.medico_responsavel || "", crm_medico: e.crm_medico || "", observations: e.observations || "" }); setDialogOpen(true); };

  const getEmpName = (id) => employees.find(e => e.id === id)?.full_name || "—";
  const getContractLabel = (cid) => { const c = contracts.find(x => x.id === cid); if (!c) return "—"; const cl = clients.find(x => x.id === c.client_id); return `${c.contract_number} — ${cl?.name || ""}`; };

  const isExpiring = (d) => d && isBefore(new Date(d), addDays(new Date(), 30)) && !isBefore(new Date(d), new Date());
  const isExpired = (d) => d && isBefore(new Date(d), new Date());

  const filtered = exames.filter(e => {
    if (filterTipo && e.tipo !== filterTipo) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterContract && e.contract_id !== filterContract) return false;
    return true;
  });

  const vencendo = exames.filter(e => isExpiring(e.due_date) && e.status !== "realizado").length;
  const vencidos = exames.filter(e => isExpired(e.due_date) && e.status !== "realizado").length;

  const s = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exames Ocupacionais</h1>
            <p className="text-gray-500 text-sm">Controle de exames — PCMSO / NR-07</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Novo Exame
        </Button>
      </div>

      {(vencidos > 0 || vencendo > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vencidos > 0 && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3"><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-red-700 text-sm font-medium">{vencidos} exame(s) vencido(s)</span></div>}
          {vencendo > 0 && <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3"><AlertTriangle className="w-4 h-4 text-yellow-600" /><span className="text-yellow-700 text-sm font-medium">{vencendo} exame(s) vencendo em 30 dias</span></div>}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center bg-white border rounded-lg p-4">
        <select className="border rounded-md px-3 py-2 text-sm" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="border rounded-md px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="border rounded-md px-3 py-2 text-sm min-w-[200px]" value={filterContract} onChange={e => setFilterContract(e.target.value)}>
          <option value="">Todos os contratos</option>
          {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} exames</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Exame</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Realização</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8">Nenhum exame cadastrado</TableCell></TableRow>}
              {filtered.map(e => {
                const expired = isExpired(e.due_date) && e.status !== "realizado";
                const expiring = isExpiring(e.due_date) && e.status !== "realizado";
                return (
                  <TableRow key={e.id} className={expired ? "bg-red-50" : expiring ? "bg-yellow-50" : ""}>
                    <TableCell className="font-medium text-sm">{getEmpName(e.employee_id)}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{e.exam_name}</div>
                      {e.esocial_code && <div className="text-xs text-gray-400">eSocial: {e.esocial_code}</div>}
                    </TableCell>
                    <TableCell><Badge className={TIPO_COLORS[e.tipo]}>{TIPO_LABELS[e.tipo]}</Badge></TableCell>
                    <TableCell className="text-sm">{e.exam_date ? format(new Date(e.exam_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      <div className={`text-sm ${expired ? "text-red-600 font-medium" : expiring ? "text-yellow-600 font-medium" : ""}`}>
                        {e.due_date ? format(new Date(e.due_date), "dd/MM/yyyy") : "—"}
                      </div>
                      {expired && <div className="text-xs text-red-500">Vencido</div>}
                      {expiring && <div className="text-xs text-yellow-600">Vencendo</div>}
                    </TableCell>
                    <TableCell><Badge className={RESULTADO_COLORS[e.resultado]}>{RESULTADO_LABELS[e.resultado]}</Badge></TableCell>
                    <TableCell><Badge className={STATUS_COLORS[e.status]}>{STATUS_LABELS[e.status]}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(e.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Exame" : "Novo Exame Ocupacional"}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Funcionário *</Label>
                <select required className="w-full border rounded-md px-3 py-2 text-sm" value={formData.employee_id} onChange={e => s("employee_id", e.target.value)}>
                  <option value="">Selecione...</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </div>
              <div>
                <Label>Tipo de Exame *</Label>
                <Select required value={formData.tipo} onValueChange={v => s("tipo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contrato</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={formData.contract_id} onChange={e => s("contract_id", e.target.value)}>
                  <option value="">Sem contrato específico</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
                </select>
              </div>
              <div>
                <Label>Nome do Exame *</Label>
                <Input required value={formData.exam_name} onChange={e => s("exam_name", e.target.value)} placeholder="Ex: Audiometria ocupacional" />
              </div>
              <div>
                <Label>Código eSocial</Label>
                <Input value={formData.esocial_code} onChange={e => s("esocial_code", e.target.value)} placeholder="Ex: S-2220" />
              </div>
              <div>
                <Label>Data de Realização</Label>
                <Input type="date" value={formData.exam_date} onChange={e => s("exam_date", e.target.value)} />
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input type="date" value={formData.due_date} onChange={e => s("due_date", e.target.value)} />
              </div>
              <div>
                <Label>Resultado</Label>
                <Select value={formData.resultado} onValueChange={v => s("resultado", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(RESULTADO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => s("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Médico Responsável</Label>
                <Input value={formData.medico_responsavel} onChange={e => s("medico_responsavel", e.target.value)} />
              </div>
              <div>
                <Label>CRM</Label>
                <Input value={formData.crm_medico} onChange={e => s("crm_medico", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={formData.observations} onChange={e => s("observations", e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">{editing ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}