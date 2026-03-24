import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Minus } from "lucide-react";

const NATURES = ["FALTA","ATRASO","ADIANTAMENTO","VALE_TRANSPORTE","PLANO_SAUDE","PLANO_DENTAL","EMPRESTIMO","OUTROS"];
const EMPTY = { employee_id:"", reference_month:"", description:"", type:"FIXO", nature:"OUTROS", amount:"", percentage:"", notes:"" };

export default function DiscountRecordsPage() {
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [monthFilter, setMonthFilter] = useState("");

  const { data: records = [] } = useQuery({ queryKey: ["discountRecords", user?.company_id], queryFn: () => base44.entities.DiscountRecord.filter({ company_id: user.company_id }), enabled: !!user?.company_id });
  const { data: employees = [] } = useQuery({ queryKey: ["employees", user?.company_id], queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }), enabled: !!user?.company_id });

  const save = useMutation({
    mutationFn: (d) => editing ? base44.entities.DiscountRecord.update(editing, d) : base44.entities.DiscountRecord.create({...d, company_id: user.company_id}),
    onSuccess: () => { qc.invalidateQueries(["discountRecords"]); setOpen(false); setEditing(null); setForm(EMPTY); }
  });
  const del = useMutation({ mutationFn: (id) => base44.entities.DiscountRecord.delete(id), onSuccess: () => qc.invalidateQueries(["discountRecords"]) });

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));
  const empName = (id) => employees.find(e => e.id === id)?.full_name || "—";
  const fmt = (v) => v ? Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "—";
  const months = [...new Set(records.map(r => r.reference_month).filter(Boolean))].sort((a,b) => b.localeCompare(a));
  const shown = monthFilter ? records.filter(r => r.reference_month === monthFilter) : records;
  const total = shown.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Minus className="w-6 h-6" />Descontos</h1><p className="text-gray-500 text-sm">Registros de descontos manuais por funcionário</p></div>
        <div className="flex gap-2">
          <Select value={monthFilter} onValueChange={setMonthFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Filtrar mês" /></SelectTrigger>
            <SelectContent><SelectItem value={null}>Todos</SelectItem>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Novo Desconto</Button>
        </div>
      </div>

      {monthFilter && <div className="text-sm text-gray-600">Total de descontos em <strong>{monthFilter}</strong>: <strong className="text-red-600">{fmt(total)}</strong> ({shown.length} registros)</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500">
            <tr><th className="text-left px-3 py-2">Funcionário</th><th className="text-left px-3 py-2">Competência</th><th className="text-left px-3 py-2">Descrição</th><th className="text-left px-3 py-2">Natureza</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Valor</th><th className="text-left px-3 py-2">Na Folha</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {shown.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-3 py-2">{empName(r.employee_id)}</td>
                <td className="px-3 py-2 text-xs">{r.reference_month}</td>
                <td className="px-3 py-2">{r.description}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{r.nature}</Badge></td>
                <td className="px-3 py-2 text-xs">{r.type}</td>
                <td className="px-3 py-2 font-semibold text-red-600">{fmt(r.amount)}</td>
                <td className="px-3 py-2 text-center">{r.applied_in_payroll ? "✅" : "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setForm(r); setEditing(r.id); setOpen(true); }}><Edit className="w-3 h-3"/></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => del.mutate(r.id)}><Trash2 className="w-3 h-3"/></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum desconto encontrado</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Desconto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Funcionário</Label>
              <Select value={form.employee_id} onValueChange={f("employee_id")}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Competência (MM/YYYY)</Label><Input value={form.reference_month} onChange={e => f("reference_month")(e.target.value)} placeholder="03/2026" /></div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={e => f("description")(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={f("type")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="FIXO">Fixo</SelectItem><SelectItem value="PERCENTUAL">Percentual</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Natureza</Label>
                <Select value={form.nature} onValueChange={f("nature")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{NATURES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" value={form.amount} onChange={e => f("amount")(+e.target.value)} /></div>
              {form.type === "PERCENTUAL" && <div><Label>Percentual (%)</Label><Input type="number" value={form.percentage} onChange={e => f("percentage")(+e.target.value)} /></div>}
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => f("notes")(e.target.value)} rows={2} /></div>
            <Button className="w-full" onClick={() => save.mutate(form)} disabled={save.isPending}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}