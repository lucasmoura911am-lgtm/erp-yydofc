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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Scale } from "lucide-react";

const RULE_TYPES = ["HORA_EXTRA","DSR","ADICIONAL_NOTURNO","FALTA","ATRASO","INSS","FGTS","IRRF","COMISSAO","BONUS","DESCONTO_GENERICO"];
const CALC_TYPES = ["PERCENTUAL","VALOR_FIXO","FORMULA"];
const APPLIES_ON = ["SALARIO_BASE","HORA","TOTAL_PROVENTOS","HORA_EXTRA","SALARIO_BRUTO"];

const EMPTY = { name:"", description:"", rule_type:"HORA_EXTRA", calculation_type:"PERCENTUAL", percentage:"", fixed_value:"", formula:"", applies_on:"HORA", priority:0, active:true, version:1, notes:"" };

export default function LaborRulesPage() {
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);

  const { data: rules = [] } = useQuery({
    queryKey: ["laborRules"],
    queryFn: () => base44.entities.LaborRule.list("-priority", 200),
  });

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.LaborRule.update(editing, data) : base44.entities.LaborRule.create({ ...data, company_id: user?.company_id }),
    onSuccess: () => { qc.invalidateQueries(["laborRules"]); setOpen(false); setEditing(null); setForm(EMPTY); }
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.LaborRule.delete(id),
    onSuccess: () => qc.invalidateQueries(["laborRules"])
  });

  const openEdit = (r) => { setForm(r); setEditing(r.id); setOpen(true); };
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const TYPE_COLOR = { HORA_EXTRA:"blue", DSR:"purple", ADICIONAL_NOTURNO:"orange", FALTA:"red", ATRASO:"orange", INSS:"gray", FGTS:"green", IRRF:"red", COMISSAO:"emerald", BONUS:"yellow", DESCONTO_GENERICO:"gray" };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Scale className="w-6 h-6" /> Regras Trabalhistas CLT</h1>
          <p className="text-gray-500 text-sm mt-1">Parametrize as regras de cálculo da folha</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Nova Regra</Button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rules.map(r => (
          <Card key={r.id} className={!r.active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-semibold">{r.name}</CardTitle>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}><Edit className="w-3.5 h-3.5"/></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => del.mutate(r.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline" className="text-[10px]">{r.rule_type}</Badge>
                <Badge variant="outline" className="text-[10px]">{r.calculation_type}</Badge>
                {!r.active && <Badge variant="outline" className="text-[10px] text-gray-400">Inativa</Badge>}
              </div>
            </CardHeader>
            <CardContent className="text-xs text-gray-600 space-y-1">
              {r.percentage && <div>Percentual: <strong>{r.percentage}%</strong></div>}
              {r.fixed_value && <div>Valor Fixo: <strong>R$ {r.fixed_value}</strong></div>}
              {r.formula && <div className="font-mono bg-gray-50 p-1 rounded text-[10px] truncate">{r.formula}</div>}
              <div>Aplica sobre: <strong>{r.applies_on}</strong></div>
              {r.description && <div className="text-gray-400">{r.description}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-screen overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Regra Trabalhista</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => f("name")(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.rule_type} onValueChange={f("rule_type")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RULE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo de Cálculo</Label>
                <Select value={form.calculation_type} onValueChange={f("calculation_type")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CALC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Aplica Sobre</Label>
              <Select value={form.applies_on} onValueChange={f("applies_on")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{APPLIES_ON.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.calculation_type === "PERCENTUAL" && <div><Label>Percentual (%)</Label><Input type="number" value={form.percentage} onChange={e => f("percentage")(e.target.value)} /></div>}
            {form.calculation_type === "VALOR_FIXO" && <div><Label>Valor Fixo (R$)</Label><Input type="number" value={form.fixed_value} onChange={e => f("fixed_value")(e.target.value)} /></div>}
            {form.calculation_type === "FORMULA" && <div><Label>Fórmula</Label><Textarea value={form.formula} onChange={e => f("formula")(e.target.value)} rows={3} placeholder="Ex: salario_base / horas_mensais * horas_extra * 1.5" /></div>}
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => f("description")(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prioridade</Label><Input type="number" value={form.priority} onChange={e => f("priority")(+e.target.value)} /></div>
              <div><Label>Versão</Label><Input type="number" value={form.version} onChange={e => f("version")(+e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vigência de</Label><Input type="date" value={form.valid_from || ""} onChange={e => f("valid_from")(e.target.value)} /></div>
              <div><Label>Vigência até</Label><Input type="date" value={form.valid_until || ""} onChange={e => f("valid_until")(e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={f("active")} /><Label>Regra Ativa</Label></div>
            <Button className="w-full" onClick={() => save.mutate(form)} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}