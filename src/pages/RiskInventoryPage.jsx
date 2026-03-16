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
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, Edit, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";

const RISK_TYPE_LABELS = { fisico: "Físico", quimico: "Químico", biologico: "Biológico", ergonomico: "Ergonômico", acidente: "Acidente" };
const RISK_LEVEL_COLORS = { baixo: "bg-green-100 text-green-800", medio: "bg-yellow-100 text-yellow-800", alto: "bg-orange-100 text-orange-800", critico: "bg-red-100 text-red-800" };
const RISK_LEVEL_LABELS = { baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico" };
const RISK_TYPE_COLORS = { fisico: "bg-blue-100 text-blue-800", quimico: "bg-purple-100 text-purple-800", biologico: "bg-emerald-100 text-emerald-800", ergonomico: "bg-amber-100 text-amber-800", acidente: "bg-red-100 text-red-800" };

const emptyForm = { contract_id: "", risk_name: "", risk_type: "", risk_description: "", risk_level: "medio", probability: "media", severity: "moderada", control_measures: "", department_id: "", allocation_id: "", position_id: "" };

export default function RiskInventoryPage() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filterContract, setFilterContract] = useState("");
  const [filterType, setFilterType] = useState("");

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();

  const { data: risks = [] } = useQuery({ queryKey: ["risks"], queryFn: () => base44.entities.RiskInventory.list(), enabled: !!user });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list(), enabled: !!user });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), enabled: !!user });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: () => base44.entities.Department.list(), enabled: !!user });
  const { data: positions = [] } = useQuery({ queryKey: ["positions"], queryFn: () => base44.entities.Position.list(), enabled: !!user });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.RiskInventory.update(editing.id, data) : base44.entities.RiskInventory.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { qc.invalidateQueries(["risks"]); toast.success("Risco salvo!"); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RiskInventory.delete(id),
    onSuccess: () => { qc.invalidateQueries(["risks"]); toast.success("Risco removido!"); }
  });

  const resetForm = () => { setFormData(emptyForm); setEditing(null); setDialogOpen(false); };
  const handleEdit = (r) => { setEditing(r); setFormData({ contract_id: r.contract_id, risk_name: r.risk_name, risk_type: r.risk_type, risk_description: r.risk_description || "", risk_level: r.risk_level, probability: r.probability || "media", severity: r.severity || "moderada", control_measures: r.control_measures || "", department_id: r.department_id || "", allocation_id: r.allocation_id || "", position_id: r.position_id || "" }); setDialogOpen(true); };

  const getContractLabel = (cid) => { const c = contracts.find(x => x.id === cid); if (!c) return "—"; const cl = clients.find(x => x.id === c.client_id); return `${c.contract_number} — ${cl?.name || ""}`; };

  const filtered = risks.filter(r => {
    if (filterContract && r.contract_id !== filterContract) return false;
    if (filterType && r.risk_type !== filterType) return false;
    return true;
  });

  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventário de Riscos</h1>
            <p className="text-gray-500 text-sm">Mapeamento de riscos ocupacionais por contrato</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo Risco</Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="min-w-[220px]">
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={filterContract} onChange={e => setFilterContract(e.target.value)}>
                <option value="">Todos os contratos</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
              </select>
            </div>
            <div className="min-w-[160px]">
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">Todos os tipos</option>
                {Object.entries(RISK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <span className="text-sm text-gray-500">{filtered.length} risco(s)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risco</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Nenhum risco cadastrado</TableCell></TableRow>}
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.risk_name}</div>
                    {r.risk_description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{r.risk_description}</div>}
                  </TableCell>
                  <TableCell><Badge className={RISK_TYPE_COLORS[r.risk_type]}>{RISK_TYPE_LABELS[r.risk_type]}</Badge></TableCell>
                  <TableCell><Badge className={RISK_LEVEL_COLORS[r.risk_level]}>{RISK_LEVEL_LABELS[r.risk_level]}</Badge></TableCell>
                  <TableCell className="capitalize text-sm">{r.probability || "—"}</TableCell>
                  <TableCell className="capitalize text-sm">{r.severity || "—"}</TableCell>
                  <TableCell className="text-sm">{getContractLabel(r.contract_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir risco?")) deleteMutation.mutate(r.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Risco" : "Novo Risco Ocupacional"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
            <div>
              <Label>Contrato *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm" value={formData.contract_id} onChange={e => set("contract_id", e.target.value)}>
                <option value="">Selecione...</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome do Risco *</Label>
                <Input required value={formData.risk_name} onChange={e => set("risk_name", e.target.value)} placeholder="Ex: Ruído excessivo" />
              </div>
              <div>
                <Label>Tipo de Risco *</Label>
                <Select required value={formData.risk_type} onValueChange={v => set("risk_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisico">Físico</SelectItem>
                    <SelectItem value="quimico">Químico</SelectItem>
                    <SelectItem value="biologico">Biológico</SelectItem>
                    <SelectItem value="ergonomico">Ergonômico</SelectItem>
                    <SelectItem value="acidente">Acidente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formData.risk_description} onChange={e => set("risk_description", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Nível de Risco</Label>
                <Select value={formData.risk_level} onValueChange={v => set("risk_level", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Probabilidade</Label>
                <Select value={formData.probability} onValueChange={v => set("probability", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severidade</Label>
                <Select value={formData.severity} onValueChange={v => set("severity", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="moderada">Moderada</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                    <SelectItem value="gravissima">Gravíssima</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Medidas de Controle</Label>
              <Textarea value={formData.control_measures} onChange={e => set("control_measures", e.target.value)} rows={2} placeholder="EPC, EPI, medidas administrativas..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Setor</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={formData.department_id} onChange={e => set("department_id", e.target.value)}>
                  <option value="">Todos</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Cargo</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={formData.position_id} onChange={e => set("position_id", e.target.value)}>
                  <option value="">Todos</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit">{editing ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}