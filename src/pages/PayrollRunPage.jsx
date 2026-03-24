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
import { Plus, Edit, Lock, Unlock, FileText } from "lucide-react";

const STATUS_COLOR = { ABERTA:"green", PROCESSANDO:"yellow", FECHADA:"gray", CANCELADA:"red" };
const EMPTY = { reference_month: "", status: "ABERTA", notes: "", locked: false };

export default function PayrollRunPage() {
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);

  const { data: runs = [] } = useQuery({
    queryKey: ["payrollRuns", user?.company_id],
    queryFn: () => base44.entities.PayrollRun.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const save = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.PayrollRun.update(editing, data)
      : base44.entities.PayrollRun.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { qc.invalidateQueries(["payrollRuns"]); setOpen(false); setEditing(null); setForm(EMPTY); }
  });

  const toggleLock = useMutation({
    mutationFn: ({id, locked}) => base44.entities.PayrollRun.update(id, { locked: !locked, status: !locked ? "FECHADA" : "ABERTA" }),
    onSuccess: () => qc.invalidateQueries(["payrollRuns"])
  });

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));
  const openEdit = (r) => { setForm(r); setEditing(r.id); setOpen(true); };

  const fmt = (v) => v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> Processamento de Folha</h1>
          <p className="text-gray-500 text-sm">Gerenciamento de folhas mensais por competência</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true); }} disabled={!user?.company_id}>
          <Plus className="w-4 h-4 mr-2" />Nova Folha
        </Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {runs.sort((a,b) => b.reference_month?.localeCompare(a.reference_month)).map(r => (
          <Card key={r.id} className={r.locked ? "border-gray-300" : ""}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{r.reference_month}</CardTitle>
                  <Badge variant="outline" className={`text-[10px] mt-1 text-${STATUS_COLOR[r.status]}-600 border-${STATUS_COLOR[r.status]}-300`}>{r.status}</Badge>
                </div>
                <div className="flex gap-1">
                  {!r.locked && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}><Edit className="w-3.5 h-3.5"/></Button>}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleLock.mutate({id: r.id, locked: r.locked})}>
                    {r.locked ? <Unlock className="w-3.5 h-3.5 text-orange-500"/> : <Lock className="w-3.5 h-3.5 text-gray-400"/>}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Funcionários</span><span className="font-medium">{r.total_employees || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Proventos</span><span className="font-medium text-green-600">{fmt(r.total_gross)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Descontos</span><span className="font-medium text-red-600">{fmt(r.total_discounts)}</span></div>
              <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Líquido Total</span><span className="font-bold text-blue-600">{fmt(r.total_net)}</span></div>
              {r.locked && <div className="text-xs text-gray-400 text-center mt-1">🔒 Folha fechada</div>}
              {r.notes && <div className="text-xs text-gray-400">{r.notes}</div>}
            </CardContent>
          </Card>
        ))}
        {runs.length === 0 && <div className="col-span-3 text-center py-16 text-gray-400">Nenhuma folha cadastrada</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Folha de Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Competência (MM/YYYY)</Label><Input value={form.reference_month} onChange={e => f("reference_month")(e.target.value)} placeholder="03/2026" /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={f("status")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTA">Aberta</SelectItem>
                  <SelectItem value="PROCESSANDO">Processando</SelectItem>
                  <SelectItem value="FECHADA">Fechada</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Input value={form.notes} onChange={e => f("notes")(e.target.value)} /></div>
            <Button className="w-full" onClick={() => save.mutate(form)} disabled={save.isPending}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}