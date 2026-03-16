import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
const emptyForm = { responsible_name: "", responsible_email: "", period: format(new Date(), "yyyy-MM"), revenue_goal: "", deals_goal: "", activities_goal: "", leads_goal: "", notes: "" };

export default function CRMGoals() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [selectedPeriod, setSelectedPeriod] = useState(format(new Date(), "yyyy-MM"));
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: goals = [] } = useQuery({ queryKey: ["crm_goals", cid], queryFn: () => base44.entities.CRMGoal.filter({ company_id: cid }), enabled: !!cid });
  const { data: opportunities = [] } = useQuery({ queryKey: ["crm_opp", cid], queryFn: () => base44.entities.CRMOpportunity.filter({ company_id: cid }), enabled: !!cid });
  const { data: activities = [] } = useQuery({ queryKey: ["crm_act", cid], queryFn: () => base44.entities.CRMActivity.filter({ company_id: cid }), enabled: !!cid });
  const { data: leads = [] } = useQuery({ queryKey: ["crm_leads", cid], queryFn: () => base44.entities.CRMLead.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({ mutationFn: (d) => base44.entities.CRMGoal.create({ ...d, company_id: cid }), onSuccess: () => { qc.invalidateQueries(["crm_goals"]); toast.success("Meta criada!"); setDialogOpen(false); setFormData(emptyForm); } });
  const updateMutation = useMutation({ mutationFn: ({ id, d }) => base44.entities.CRMGoal.update(id, d), onSuccess: () => { qc.invalidateQueries(["crm_goals"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.CRMGoal.delete(id), onSuccess: () => { qc.invalidateQueries(["crm_goals"]); toast.success("Excluído!"); } });

  const handleSubmit = (e) => {
    e.preventDefault();
    const d = { ...formData, revenue_goal: parseFloat(formData.revenue_goal) || 0, deals_goal: parseInt(formData.deals_goal) || 0, activities_goal: parseInt(formData.activities_goal) || 0, leads_goal: parseInt(formData.leads_goal) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, d });
    else createMutation.mutate(d);
  };

  const openEdit = (g) => { setEditing(g); setFormData({ ...emptyForm, ...g }); setDialogOpen(true); };

  const periodGoals = goals.filter(g => g.period === selectedPeriod);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM/yyyy", { locale: ptBR }) };
  });

  // Get actual for period
  const getActual = (responsible_email) => {
    const inPeriod = (d) => d?.startsWith(selectedPeriod);
    const revenue = opportunities.filter(o => (o.responsible_email === responsible_email || o.responsible_name === responsible_email) && o.stage === "fechado_ganho" && inPeriod(o.close_date)).reduce((s, o) => s + (o.value || 0), 0);
    const deals = opportunities.filter(o => (o.responsible_email === responsible_email || o.responsible_name === responsible_email) && o.stage === "fechado_ganho" && inPeriod(o.close_date)).length;
    const acts = activities.filter(a => (a.responsible_email === responsible_email || a.responsible_name === responsible_email) && inPeriod(a.date) && a.status === "realizada").length;
    const ls = leads.filter(l => (l.responsible_email === responsible_email || l.responsible_name === responsible_email) && inPeriod(l.created_date)).length;
    return { revenue, deals, acts, ls };
  };

  const ProgressBar = ({ label, current, goal, format: formatFn }) => {
    const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium">{formatFn ? formatFn(current) : current} / {formatFn ? formatFn(goal) : goal}</span>
        </div>
        <div className="bg-gray-100 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-right mt-0.5 text-gray-400">{pct.toFixed(0)}%</p>
      </div>
    );
  };

  // Chart data
  const chartData = periodGoals.map(g => {
    const actual = getActual(g.responsible_email);
    return {
      name: g.responsible_name || g.responsible_email?.split("@")[0] || "—",
      "Meta Receita": g.revenue_goal,
      "Receita Atual": actual.revenue,
    };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Metas Comerciais</h1>
          <p className="text-gray-500 text-sm">Acompanhe as metas por vendedor</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setFormData({ ...emptyForm, period: selectedPeriod }); }} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                <Plus className="w-4 h-4 mr-2" /> Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Meta</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Vendedor *</Label><Input value={formData.responsible_name} onChange={e => setFormData({ ...formData, responsible_name: e.target.value })} required placeholder="Nome do vendedor" /></div>
                  <div className="col-span-2"><Label>E-mail</Label><Input type="email" value={formData.responsible_email} onChange={e => setFormData({ ...formData, responsible_email: e.target.value })} /></div>
                  <div>
                    <Label>Período</Label>
                    <Select value={formData.period} onValueChange={v => setFormData({ ...formData, period: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Meta Receita (R$)</Label><Input type="number" value={formData.revenue_goal} onChange={e => setFormData({ ...formData, revenue_goal: e.target.value })} /></div>
                  <div><Label>Meta Negócios</Label><Input type="number" value={formData.deals_goal} onChange={e => setFormData({ ...formData, deals_goal: e.target.value })} /></div>
                  <div><Label>Meta Atividades</Label><Input type="number" value={formData.activities_goal} onChange={e => setFormData({ ...formData, activities_goal: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Meta Leads</Label><Input type="number" value={formData.leads_goal} onChange={e => setFormData({ ...formData, leads_goal: e.target.value })} /></div>
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">{editing ? "Atualizar" : "Criar"}</Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {periodGoals.map(g => {
          const actual = getActual(g.responsible_email || g.responsible_name);
          return (
            <Card key={g.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{g.responsible_name}</CardTitle>
                  <p className="text-xs text-gray-400">{g.period}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(g)}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(g.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressBar label="Receita" current={actual.revenue} goal={g.revenue_goal} format={fmt} />
                <ProgressBar label="Negócios Fechados" current={actual.deals} goal={g.deals_goal} />
                <ProgressBar label="Atividades" current={actual.acts} goal={g.activities_goal} />
                <ProgressBar label="Leads" current={actual.ls} goal={g.leads_goal} />
              </CardContent>
            </Card>
          );
        })}
        {periodGoals.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma meta cadastrada para {selectedPeriod}</p>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Meta vs Realizado — Receita</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={fmt} />
                <Legend />
                <Bar dataKey="Meta Receita" fill="#c4b5fd" radius={[3,3,0,0]} />
                <Bar dataKey="Receita Atual" fill="#6366f1" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}