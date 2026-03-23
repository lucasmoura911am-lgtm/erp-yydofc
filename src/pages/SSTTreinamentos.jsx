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
import { BookOpen, Plus, Edit, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TIPO_LABELS = { inicial: "Inicial", periodico: "Periódico", dds: "DDS", sipat: "SIPAT", integracao: "Integração", reciclagem: "Reciclagem" };
const TIPO_COLORS = { inicial: "bg-blue-100 text-blue-800", periodico: "bg-purple-100 text-purple-800", dds: "bg-teal-100 text-teal-800", sipat: "bg-orange-100 text-orange-800", integracao: "bg-green-100 text-green-800", reciclagem: "bg-yellow-100 text-yellow-800" };
const STATUS_COLORS = { agendado: "bg-blue-100 text-blue-800", realizado: "bg-green-100 text-green-800", cancelado: "bg-gray-100 text-gray-700" };
const STATUS_LABELS = { agendado: "Agendado", realizado: "Realizado", cancelado: "Cancelado" };

const emptyForm = { title: "", tipo: "dds", tema: "", nr_referencia: "", carga_horaria: "", training_date: "", next_date: "", instrutor: "", participantes: [], status: "agendado", local: "", observations: "" };

export default function SSTTreinamentos() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();

  const { data: treinamentos = [] } = useQuery({ queryKey: ["sst_treinamentos"], queryFn: () => base44.entities.SSTTreinamento.list("-created_date"), enabled: !!user });
  const { data: employees = [] } = useQuery({ queryKey: ["employees_sst"], queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }), enabled: !!user?.company_id });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list(), enabled: !!user });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), enabled: !!user });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.SSTTreinamento.update(editing.id, data) : base44.entities.SSTTreinamento.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { qc.invalidateQueries(["sst_treinamentos"]); toast.success("Treinamento salvo!"); resetForm(); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SSTTreinamento.delete(id),
    onSuccess: () => { qc.invalidateQueries(["sst_treinamentos"]); toast.success("Removido!"); }
  });

  const resetForm = () => { setFormData(emptyForm); setEditing(null); setDialogOpen(false); };
  const handleEdit = (t) => { setEditing(t); setFormData({ title: t.title, tipo: t.tipo, tema: t.tema || "", nr_referencia: t.nr_referencia || "", carga_horaria: t.carga_horaria || "", training_date: t.training_date || "", next_date: t.next_date || "", instrutor: t.instrutor || "", participantes: t.participantes || [], status: t.status, local: t.local || "", observations: t.observations || "" }); setDialogOpen(true); };

  const getContractLabel = (cid) => { const c = contracts.find(x => x.id === cid); if (!c) return "—"; const cl = clients.find(x => x.id === c.client_id); return `${c.contract_number} — ${cl?.name || ""}`; };
  const toggleParticipante = (id) => setFormData(f => ({ ...f, participantes: f.participantes.includes(id) ? f.participantes.filter(x => x !== id) : [...f.participantes, id] }));

  const filtered = treinamentos.filter(t => {
    if (filterTipo && t.tipo !== filterTipo) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  const s = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Treinamentos SST</h1>
            <p className="text-gray-500 text-sm">DDS, SIPAT, integrações e treinamentos periódicos</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4" /> Novo Treinamento
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <Card key={k} className={`cursor-pointer border-2 ${filterStatus === k ? 'border-teal-400' : 'border-transparent'}`} onClick={() => setFilterStatus(filterStatus === k ? "" : k)}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{treinamentos.filter(t => t.status === k).length}</div>
              <div className="text-xs text-gray-500">{v}</div>
            </CardContent>
          </Card>
        ))}
        <Card className={`cursor-pointer border-2 ${filterStatus === "" ? 'border-teal-400' : 'border-transparent'}`} onClick={() => setFilterStatus("")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{treinamentos.length}</div>
            <div className="text-xs text-gray-500">Total</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-white border rounded-lg p-4">
        <select className="border rounded-md px-3 py-2 text-sm" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} treinamentos</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Treinamento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>NR Ref.</TableHead>
                <TableHead>Carga H.</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Participantes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8">Nenhum treinamento cadastrado</TableCell></TableRow>}
              {filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{t.title}</div>
                    {t.tema && <div className="text-xs text-gray-400">{t.tema}</div>}
                    {t.instrutor && <div className="text-xs text-gray-400">Instrutor: {t.instrutor}</div>}
                  </TableCell>
                  <TableCell><Badge className={TIPO_COLORS[t.tipo]}>{TIPO_LABELS[t.tipo]}</Badge></TableCell>
                  <TableCell className="text-sm">{t.nr_referencia || "—"}</TableCell>
                  <TableCell className="text-sm">{t.carga_horaria ? `${t.carga_horaria}h` : "—"}</TableCell>
                  <TableCell className="text-sm">{t.training_date ? format(new Date(t.training_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {t.participantes?.length || 0}
                    </div>
                  </TableCell>
                  <TableCell><Badge className={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(t.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Treinamento" : "Novo Treinamento"}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input required value={formData.title} onChange={e => s("title", e.target.value)} placeholder="Ex: DDS - Uso correto de EPI" />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={formData.tipo} onValueChange={v => s("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>NR de Referência</Label>
                <Input value={formData.nr_referencia} onChange={e => s("nr_referencia", e.target.value)} placeholder="Ex: NR-06" />
              </div>
              <div className="col-span-2">
                <Label>Tema</Label>
                <Input value={formData.tema} onChange={e => s("tema", e.target.value)} />
              </div>
              <div>
                <Label>Carga Horária (h)</Label>
                <Input type="number" min={0} value={formData.carga_horaria} onChange={e => s("carga_horaria", parseFloat(e.target.value))} />
              </div>
              <div>
                <Label>Instrutor</Label>
                <Input value={formData.instrutor} onChange={e => s("instrutor", e.target.value)} />
              </div>
              <div>
                <Label>Data de Realização</Label>
                <Input type="date" value={formData.training_date} onChange={e => s("training_date", e.target.value)} />
              </div>
              <div>
                <Label>Próxima Realização</Label>
                <Input type="date" value={formData.next_date} onChange={e => s("next_date", e.target.value)} />
              </div>
              <div>
                <Label>Local</Label>
                <Input value={formData.local} onChange={e => s("local", e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => s("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Participantes</Label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {employees.length === 0 && <p className="text-xs text-gray-400">Nenhum funcionário cadastrado</p>}
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input type="checkbox" checked={formData.participantes.includes(emp.id)} onChange={() => toggleParticipante(emp.id)} className="rounded" />
                      <span className="text-sm">{emp.full_name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{formData.participantes.length} selecionado(s)</p>
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={formData.observations} onChange={e => s("observations", e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">{editing ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}