import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Zap } from "lucide-react";

const NATURES = ["SALARIO","HORA_EXTRA_50","HORA_EXTRA_100","DSR","ADICIONAL_NOTURNO","COMISSAO","BONUS","FALTA","ATRASO","INSS","FGTS","IRRF","VALE_TRANSPORTE","PLANO_SAUDE","OUTROS_DESCONTO","OUTROS_PROVENTO"];
const EMPTY = { name:"", code:"", type:"PROVENTO", nature:"SALARIO", incidences:{inss:false,fgts:false,irrf:false,dsr:false}, default_value:"", active:true, sort_order:0 };

export default function PayrollEventsPage() {
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [typeFilter, setTypeFilter] = useState("ALL");

  const { data: events = [] } = useQuery({
    queryKey: ["payrollEvents"],
    queryFn: () => base44.entities.PayrollEvent.list("sort_order", 200),
  });

  const { data: laborRules = [] } = useQuery({
    queryKey: ["laborRules"],
    queryFn: () => base44.entities.LaborRule.list("name", 100),
  });

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.PayrollEvent.update(editing, data) : base44.entities.PayrollEvent.create(data),
    onSuccess: () => { qc.invalidateQueries(["payrollEvents"]); setOpen(false); setEditing(null); setForm(EMPTY); }
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.PayrollEvent.delete(id),
    onSuccess: () => qc.invalidateQueries(["payrollEvents"])
  });

  const openEdit = (e) => { setForm(e); setEditing(e.id); setOpen(true); };
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));
  const fInc = (k) => (v) => setForm(p => ({ ...p, incidences: { ...p.incidences, [k]: v } }));

  const shown = typeFilter === "ALL" ? events : events.filter(e => e.type === typeFilter);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6" />Eventos da Folha</h1>
          <p className="text-gray-500 text-sm">Proventos, descontos e informativos</p>
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="PROVENTO">Proventos</SelectItem>
              <SelectItem value="DESCONTO">Descontos</SelectItem>
              <SelectItem value="INFORMATIVO">Informativos</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Novo Evento</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Natureza</th>
              <th className="text-left px-3 py-2">Incidências</th>
              <th className="text-left px-3 py-2">Ativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {shown.map(ev => (
              <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{ev.code}</td>
                <td className="px-3 py-2 font-medium">{ev.name}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={ev.type === "PROVENTO" ? "text-green-600 border-green-300" : ev.type === "DESCONTO" ? "text-red-600 border-red-300" : "text-gray-500"}>
                    {ev.type}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs">{ev.nature}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {["inss","fgts","irrf","dsr"].filter(k => ev.incidences?.[k]).map(k => k.toUpperCase()).join(", ") || "—"}
                </td>
                <td className="px-3 py-2">{ev.active ? "✅" : "❌"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(ev)}><Edit className="w-3 h-3"/></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => del.mutate(ev.id)}><Trash2 className="w-3 h-3"/></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum evento cadastrado</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Evento de Folha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={form.code} onChange={e => f("code")(e.target.value)} placeholder="HE50" /></div>
              <div><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={e => f("sort_order")(+e.target.value)} /></div>
            </div>
            <div><Label>Nome</Label><Input value={form.name} onChange={e => f("name")(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={f("type")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROVENTO">Provento</SelectItem>
                    <SelectItem value="DESCONTO">Desconto</SelectItem>
                    <SelectItem value="INFORMATIVO">Informativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Natureza</Label>
                <Select value={form.nature} onValueChange={f("nature")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{NATURES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Regra Trabalhista Vinculada</Label>
              <Select value={form.labor_rule_id || ""} onValueChange={f("labor_rule_id")}><SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>{laborRules.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Valor Padrão (R$)</Label><Input type="number" value={form.default_value} onChange={e => f("default_value")(+e.target.value)} /></div>
            <div>
              <Label className="mb-2 block">Incidências</Label>
              <div className="grid grid-cols-4 gap-2">
                {["inss","fgts","irrf","dsr"].map(k => (
                  <div key={k} className="flex items-center gap-1.5">
                    <Checkbox id={k} checked={form.incidences?.[k] || false} onCheckedChange={fInc(k)} />
                    <Label htmlFor={k} className="text-xs uppercase">{k}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={f("active")} /><Label>Ativo</Label></div>
            <Button className="w-full" onClick={() => save.mutate(form)} disabled={save.isPending}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}