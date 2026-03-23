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
import { Heart, Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, addDays } from "date-fns";

const VACINA_LABELS = { antitetanica: "Antitetânica", hepatite_b: "Hepatite B", influenza: "Influenza", covid19: "COVID-19", febre_amarela: "Febre Amarela", outras: "Outras" };
const DOSE_LABELS = { "1a_dose": "1ª Dose", "2a_dose": "2ª Dose", "3a_dose": "3ª Dose", reforco: "Reforço", dose_unica: "Dose Única" };
const STATUS_COLORS = { em_dia: "bg-green-100 text-green-800", pendente: "bg-yellow-100 text-yellow-800", vencido: "bg-red-100 text-red-800" };
const STATUS_LABELS = { em_dia: "Em Dia", pendente: "Pendente", vencido: "Vencido" };

const emptyForm = { employee_id: "", vacina: "", dose: "", application_date: "", next_date: "", status: "pendente", local_aplicacao: "", observations: "" };

export default function SSTVacinacao() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filterVacina, setFilterVacina] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();

  const { data: vacinas = [] } = useQuery({ queryKey: ["sst_vacinas"], queryFn: () => base44.entities.SSTVacinacao.list("-created_date"), enabled: !!user });
  const { data: employees = [] } = useQuery({ queryKey: ["employees_sst"], queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }), enabled: !!user?.company_id });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.SSTVacinacao.update(editing.id, data) : base44.entities.SSTVacinacao.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { qc.invalidateQueries(["sst_vacinas"]); toast.success("Vacinação salva!"); resetForm(); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SSTVacinacao.delete(id),
    onSuccess: () => { qc.invalidateQueries(["sst_vacinas"]); toast.success("Removido!"); }
  });

  const resetForm = () => { setFormData(emptyForm); setEditing(null); setDialogOpen(false); };
  const handleEdit = (v) => { setEditing(v); setFormData({ employee_id: v.employee_id, vacina: v.vacina, dose: v.dose, application_date: v.application_date || "", next_date: v.next_date || "", status: v.status, local_aplicacao: v.local_aplicacao || "", observations: v.observations || "" }); setDialogOpen(true); };

  const getEmpName = (id) => employees.find(e => e.id === id)?.full_name || "—";

  const vencidos = vacinas.filter(v => v.status === "vencido" || (v.next_date && isBefore(new Date(v.next_date), new Date()) && v.status !== "em_dia")).length;
  const vencendo = vacinas.filter(v => v.next_date && isBefore(new Date(v.next_date), addDays(new Date(), 30)) && !isBefore(new Date(v.next_date), new Date())).length;

  const filtered = vacinas.filter(v => {
    if (filterVacina && v.vacina !== filterVacina) return false;
    if (filterStatus && v.status !== filterStatus) return false;
    return true;
  });

  const s = (k, val) => setFormData(f => ({ ...f, [k]: val }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Controle de Vacinação</h1>
            <p className="text-gray-500 text-sm">Carteira vacinal dos colaboradores</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-rose-600 hover:bg-rose-700">
          <Plus className="w-4 h-4" /> Nova Vacinação
        </Button>
      </div>

      {(vencidos > 0 || vencendo > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vencidos > 0 && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3"><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-red-700 text-sm font-medium">{vencidos} vacina(s) vencida(s)</span></div>}
          {vencendo > 0 && <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3"><AlertTriangle className="w-4 h-4 text-yellow-600" /><span className="text-yellow-700 text-sm font-medium">{vencendo} vacina(s) vencendo em 30 dias</span></div>}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center bg-white border rounded-lg p-4">
        <select className="border rounded-md px-3 py-2 text-sm" value={filterVacina} onChange={e => setFilterVacina(e.target.value)}>
          <option value="">Todas as vacinas</option>
          {Object.entries(VACINA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="border rounded-md px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} registros</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Vacina</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Aplicação</TableHead>
                <TableHead>Próximo Reforço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Nenhuma vacinação cadastrada</TableCell></TableRow>}
              {filtered.map(v => {
                const expired = v.next_date && isBefore(new Date(v.next_date), new Date());
                return (
                  <TableRow key={v.id} className={expired && v.status !== "em_dia" ? "bg-red-50" : ""}>
                    <TableCell className="font-medium text-sm">{getEmpName(v.employee_id)}</TableCell>
                    <TableCell className="text-sm">{VACINA_LABELS[v.vacina] || v.vacina}</TableCell>
                    <TableCell className="text-sm">{DOSE_LABELS[v.dose] || v.dose}</TableCell>
                    <TableCell className="text-sm">{v.application_date ? format(new Date(v.application_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className={`text-sm ${expired && v.status !== "em_dia" ? "text-red-600 font-medium" : ""}`}>
                      {v.next_date ? format(new Date(v.next_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell><Badge className={STATUS_COLORS[v.status]}>{STATUS_LABELS[v.status]}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(v.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Vacinação" : "Nova Vacinação"}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
            <div>
              <Label>Funcionário *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm" value={formData.employee_id} onChange={e => s("employee_id", e.target.value)}>
                <option value="">Selecione...</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vacina *</Label>
                <Select required value={formData.vacina} onValueChange={v => s("vacina", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{Object.entries(VACINA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dose *</Label>
                <Select required value={formData.dose} onValueChange={v => s("dose", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{Object.entries(DOSE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Aplicação</Label>
                <Input type="date" value={formData.application_date} onChange={e => s("application_date", e.target.value)} />
              </div>
              <div>
                <Label>Próximo Reforço</Label>
                <Input type="date" value={formData.next_date} onChange={e => s("next_date", e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => s("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Local de Aplicação</Label>
                <Input value={formData.local_aplicacao} onChange={e => s("local_aplicacao", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={formData.observations} onChange={e => s("observations", e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-700">{editing ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}