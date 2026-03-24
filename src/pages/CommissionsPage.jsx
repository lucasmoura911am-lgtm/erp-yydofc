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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, TrendingUp } from "lucide-react";

const EMPTY_RULE = { name:"", description:"", percentage:"", applies_on:"VENDAS", min_amount:0, active:true };
const EMPTY_REC = { employee_id:"", reference_month:"", base_amount:"", percentage_applied:"", calculated_commission:"", status:"PENDENTE", notes:"" };
const STATUS_COLOR = { PENDENTE:"yellow", APROVADO:"blue", PAGO:"green", CANCELADO:"red" };

export default function CommissionsPage() {
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();
  const [ruleOpen, setRuleOpen] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const [formRule, setFormRule] = useState(EMPTY_RULE);
  const [formRec, setFormRec] = useState(EMPTY_REC);
  const [editingRule, setEditingRule] = useState(null);
  const [editingRec, setEditingRec] = useState(null);

  const { data: rules = [] } = useQuery({ queryKey: ["commissionRules", user?.company_id], queryFn: () => base44.entities.CommissionRule.filter({ company_id: user.company_id }), enabled: !!user?.company_id });
  const { data: records = [] } = useQuery({ queryKey: ["commissionRecords", user?.company_id], queryFn: () => base44.entities.CommissionRecord.filter({ company_id: user.company_id }), enabled: !!user?.company_id });
  const { data: employees = [] } = useQuery({ queryKey: ["employees", user?.company_id], queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }), enabled: !!user?.company_id });

  const saveRule = useMutation({ mutationFn: (d) => editingRule ? base44.entities.CommissionRule.update(editingRule, d) : base44.entities.CommissionRule.create({...d, company_id: user.company_id}), onSuccess: () => { qc.invalidateQueries(["commissionRules"]); setRuleOpen(false); setEditingRule(null); setFormRule(EMPTY_RULE); } });
  const saveRec = useMutation({ mutationFn: (d) => editingRec ? base44.entities.CommissionRecord.update(editingRec, d) : base44.entities.CommissionRecord.create({...d, company_id: user.company_id}), onSuccess: () => { qc.invalidateQueries(["commissionRecords"]); setRecOpen(false); setEditingRec(null); setFormRec(EMPTY_REC); } });
  const delRule = useMutation({ mutationFn: (id) => base44.entities.CommissionRule.delete(id), onSuccess: () => qc.invalidateQueries(["commissionRules"]) });
  const delRec = useMutation({ mutationFn: (id) => base44.entities.CommissionRecord.delete(id), onSuccess: () => qc.invalidateQueries(["commissionRecords"]) });

  const fmt = (v) => v ? Number(v).toLocaleString("pt-BR", {style:"currency",currency:"BRL"}) : "R$ 0,00";
  const empName = (id) => employees.find(e => e.id === id)?.full_name || id;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6" />Comissões</h1><p className="text-gray-500 text-sm">Regras e registros de comissões por funcionário</p></div>

      <Tabs defaultValue="rules">
        <TabsList><TabsTrigger value="rules">Regras</TabsTrigger><TabsTrigger value="records">Registros</TabsTrigger></TabsList>

        <TabsContent value="rules" className="mt-4 space-y-4">
          <div className="flex justify-end"><Button onClick={() => { setFormRule(EMPTY_RULE); setEditingRule(null); setRuleOpen(true); }}><Plus className="w-4 h-4 mr-2" />Nova Regra</Button></div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rules.map(r => (
              <Card key={r.id} className={!r.active ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm">{r.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setFormRule(r); setEditingRule(r.id); setRuleOpen(true); }}><Edit className="w-3 h-3"/></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => delRule.mutate(r.id)}><Trash2 className="w-3 h-3"/></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Percentual</span><strong>{r.percentage}%</strong></div>
                  <div className="flex justify-between"><span className="text-gray-500">Aplica sobre</span><span>{r.applies_on}</span></div>
                  {r.min_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Mínimo</span><span>{fmt(r.min_amount)}</span></div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="records" className="mt-4 space-y-4">
          <div className="flex justify-end"><Button onClick={() => { setFormRec(EMPTY_REC); setEditingRec(null); setRecOpen(true); }}><Plus className="w-4 h-4 mr-2" />Registrar Comissão</Button></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500">
                <tr><th className="text-left px-3 py-2">Funcionário</th><th className="text-left px-3 py-2">Competência</th><th className="text-left px-3 py-2">Base</th><th className="text-left px-3 py-2">%</th><th className="text-left px-3 py-2">Comissão</th><th className="text-left px-3 py-2">Status</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{empName(r.employee_id)}</td>
                    <td className="px-3 py-2">{r.reference_month}</td>
                    <td className="px-3 py-2">{fmt(r.base_amount)}</td>
                    <td className="px-3 py-2">{r.percentage_applied}%</td>
                    <td className="px-3 py-2 font-semibold text-green-600">{fmt(r.calculated_commission)}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={`text-[10px] text-${STATUS_COLOR[r.status]}-600`}>{r.status}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setFormRec(r); setEditingRec(r.id); setRecOpen(true); }}><Edit className="w-3 h-3"/></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => delRec.mutate(r.id)}><Trash2 className="w-3 h-3"/></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum registro de comissão</div>}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRule ? "Editar" : "Nova"} Regra de Comissão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={formRule.name} onChange={e => setFormRule(p=>({...p,name:e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Percentual (%)</Label><Input type="number" value={formRule.percentage} onChange={e => setFormRule(p=>({...p,percentage:+e.target.value}))} /></div>
              <div><Label>Aplica Sobre</Label>
                <Select value={formRule.applies_on} onValueChange={v => setFormRule(p=>({...p,applies_on:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="VENDAS">Vendas</SelectItem><SelectItem value="FATURAMENTO">Faturamento</SelectItem><SelectItem value="MARGEM">Margem</SelectItem><SelectItem value="META_ATINGIDA">Meta Atingida</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Valor Mínimo (R$)</Label><Input type="number" value={formRule.min_amount} onChange={e => setFormRule(p=>({...p,min_amount:+e.target.value}))} /></div>
            <div className="flex items-center gap-2"><Switch checked={formRule.active} onCheckedChange={v => setFormRule(p=>({...p,active:v}))} /><Label>Ativa</Label></div>
            <Button className="w-full" onClick={() => saveRule.mutate(formRule)} disabled={saveRule.isPending}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={recOpen} onOpenChange={setRecOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRec ? "Editar" : "Novo"} Registro de Comissão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Funcionário</Label>
              <Select value={formRec.employee_id} onValueChange={v => setFormRec(p=>({...p,employee_id:v}))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Competência (MM/YYYY)</Label><Input value={formRec.reference_month} onChange={e => setFormRec(p=>({...p,reference_month:e.target.value}))} placeholder="03/2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor Base (R$)</Label><Input type="number" value={formRec.base_amount} onChange={e => setFormRec(p=>({...p,base_amount:+e.target.value}))} /></div>
              <div><Label>% Aplicado</Label><Input type="number" value={formRec.percentage_applied} onChange={e => setFormRec(p=>({...p,percentage_applied:+e.target.value}))} /></div>
            </div>
            <div><Label>Comissão Calculada (R$)</Label><Input type="number" value={formRec.calculated_commission} onChange={e => setFormRec(p=>({...p,calculated_commission:+e.target.value}))} /></div>
            <div><Label>Status</Label>
              <Select value={formRec.status} onValueChange={v => setFormRec(p=>({...p,status:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PENDENTE">Pendente</SelectItem><SelectItem value="APROVADO">Aprovado</SelectItem><SelectItem value="PAGO">Pago</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => saveRec.mutate(formRec)} disabled={saveRec.isPending}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}