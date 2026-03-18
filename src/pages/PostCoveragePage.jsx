import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, ArrowRightLeft, CheckCircle, Clock, XCircle, BarChart3, Users } from "lucide-react";

const STATUS_LABELS = { agendada: "Agendada", em_andamento: "Em Andamento", concluida: "Concluída", cancelada: "Cancelada" };
const STATUS_COLORS = {
  agendada: "bg-blue-100 text-blue-800",
  em_andamento: "bg-yellow-100 text-yellow-800",
  concluida: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800"
};
const REASON_LABELS = { falta: "Falta", ferias: "Férias", atestado: "Atestado", folga: "Folga", emergencia: "Emergência", outro: "Outro" };

const emptyForm = {
  original_employee_id: "",
  backup_employee_id: "",
  allocation_id: "",
  client_id: "",
  start_datetime: "",
  end_datetime: "",
  reason: "falta",
  notes: ""
};

export default function PostCoveragePage() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("all");
  const [tab, setTab] = useState("list"); // "list" | "dashboard"
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: coverages = [] } = useQuery({
    queryKey: ["postCoverages", user?.company_id],
    queryFn: () => base44.entities.PostCoverage.filter({ company_id: user.company_id }, "-start_datetime"),
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }),
    enabled: !!user?.company_id,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations", user?.company_id],
    queryFn: () => base44.entities.Allocation.filter({ company_id: user.company_id, status: "ativo" }),
    enabled: !!user?.company_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.company_id],
    queryFn: () => base44.entities.Client.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const empMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees]);
  const allocationMap = useMemo(() => Object.fromEntries(allocations.map(a => [a.id, a])), [allocations]);
  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PostCoverage.create(data),
    onSuccess: () => { queryClient.invalidateQueries(["postCoverages"]); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PostCoverage.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["postCoverages"]); setDialogOpen(false); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, company_id: user.company_id, created_by: user.email };
    // Set client_id from allocation if not set
    if (!data.client_id && data.allocation_id) {
      data.client_id = allocationMap[data.allocation_id]?.client_id || "";
    }
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const handleEdit = (cov) => {
    setEditing(cov);
    setForm({
      original_employee_id: cov.original_employee_id,
      backup_employee_id: cov.backup_employee_id,
      allocation_id: cov.allocation_id,
      client_id: cov.client_id || "",
      start_datetime: cov.start_datetime?.substring(0, 16) || "",
      end_datetime: cov.end_datetime?.substring(0, 16) || "",
      reason: cov.reason,
      notes: cov.notes || ""
    });
    setDialogOpen(true);
  };

  const handleStatusChange = (cov, newStatus) => {
    const update = { ...cov, status: newStatus };
    if (newStatus === "concluida") update.actual_end_datetime = new Date().toISOString();
    updateMutation.mutate({ id: cov.id, data: update });
  };

  const filtered = filterStatus === "all" ? coverages : coverages.filter(c => c.status === filterStatus);

  // Dashboard stats
  const stats = useMemo(() => {
    const byEmployee = {};
    coverages.forEach(c => {
      if (!byEmployee[c.backup_employee_id]) byEmployee[c.backup_employee_id] = 0;
      byEmployee[c.backup_employee_id]++;
    });
    const topBackup = Object.entries(byEmployee).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      total: coverages.length,
      active: coverages.filter(c => c.status === "em_andamento").length,
      scheduled: coverages.filter(c => c.status === "agendada").length,
      completed: coverages.filter(c => c.status === "concluida").length,
      topBackup
    };
  }, [coverages]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-purple-600" />
            Coberturas de Posto
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Registre quando um funcionário cobre outro posto</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "list" ? "default" : "outline"} onClick={() => setTab("list")} size="sm">Lista</Button>
          <Button variant={tab === "dashboard" ? "default" : "outline"} onClick={() => setTab("dashboard")} size="sm">
            <BarChart3 className="w-4 h-4 mr-1" />Dashboard
          </Button>
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }} className="bg-gradient-to-r from-purple-600 to-blue-600">
            <Plus className="w-4 h-4 mr-2" />Nova Cobertura
          </Button>
        </div>
      </div>

      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total", value: stats.total, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Em Andamento", value: stats.active, color: "text-yellow-600", bg: "bg-yellow-50" },
              { label: "Agendadas", value: stats.scheduled, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Concluídas", value: stats.completed, color: "text-green-600", bg: "bg-green-50" },
            ].map(s => (
              <Card key={s.label} className={`${s.bg} border-0`}>
                <CardContent className="p-4 text-center">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-sm text-gray-600 mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Top backup employees */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Funcionários que mais fizeram cobertura</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topBackup.map(([empId, count]) => {
                  const emp = empMap[empId];
                  return (
                    <div key={empId} className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={emp?.photo_url} />
                        <AvatarFallback className="bg-purple-600 text-white text-sm">{emp?.full_name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{emp?.full_name || "Desconhecido"}</p>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                          <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${Math.min((count / stats.total) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">{count}x</Badge>
                    </div>
                  );
                })}
                {stats.topBackup.length === 0 && <p className="text-gray-400 text-center py-4">Nenhuma cobertura registrada</p>}
              </div>
            </CardContent>
          </Card>

          {/* Recent coverages */}
          <Card>
            <CardHeader><CardTitle>Coberturas Ativas e Agendadas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {coverages.filter(c => c.status === "em_andamento" || c.status === "agendada").map(cov => {
                  const orig = empMap[cov.original_employee_id];
                  const backup = empMap[cov.backup_employee_id];
                  const alloc = allocationMap[cov.allocation_id];
                  return (
                    <div key={cov.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8"><AvatarImage src={orig?.photo_url} /><AvatarFallback className="text-xs">{orig?.full_name?.charAt(0)}</AvatarFallback></Avatar>
                        <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                        <Avatar className="w-8 h-8"><AvatarImage src={backup?.photo_url} /><AvatarFallback className="text-xs bg-green-600 text-white">{backup?.full_name?.charAt(0)}</AvatarFallback></Avatar>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{backup?.full_name} cobre {orig?.full_name}</p>
                        <p className="text-xs text-gray-500">{alloc?.post_name} · {REASON_LABELS[cov.reason]}</p>
                      </div>
                      <Badge className={STATUS_COLORS[cov.status]}>{STATUS_LABELS[cov.status]}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "list" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Histórico de Coberturas</CardTitle>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Posto</TableHead>
                    <TableHead>Titular ausente</TableHead>
                    <TableHead>Cobertura por</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(cov => {
                    const orig = empMap[cov.original_employee_id];
                    const backup = empMap[cov.backup_employee_id];
                    const alloc = allocationMap[cov.allocation_id];
                    const client = clientMap[cov.client_id || alloc?.client_id];
                    return (
                      <TableRow key={cov.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{alloc?.post_name || "—"}</p>
                            <p className="text-xs text-gray-500">{client?.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7"><AvatarImage src={orig?.photo_url} /><AvatarFallback className="text-xs">{orig?.full_name?.charAt(0)}</AvatarFallback></Avatar>
                            <span className="text-sm">{orig?.full_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7"><AvatarImage src={backup?.photo_url} /><AvatarFallback className="text-xs bg-green-600 text-white">{backup?.full_name?.charAt(0)}</AvatarFallback></Avatar>
                            <span className="text-sm font-medium">{backup?.full_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{REASON_LABELS[cov.reason]}</Badge></TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p>{cov.start_datetime ? format(parseISO(cov.start_datetime), "dd/MM HH:mm") : "—"}</p>
                            <p className="text-gray-500">{cov.end_datetime ? format(parseISO(cov.end_datetime), "dd/MM HH:mm") : "Aberto"}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={STATUS_COLORS[cov.status]}>{STATUS_LABELS[cov.status]}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {cov.status === "agendada" && (
                              <Button size="sm" variant="ghost" className="text-yellow-600 text-xs" onClick={() => handleStatusChange(cov, "em_andamento")}>
                                <Clock className="w-3 h-3 mr-1" />Iniciar
                              </Button>
                            )}
                            {cov.status === "em_andamento" && (
                              <Button size="sm" variant="ghost" className="text-green-600 text-xs" onClick={() => handleStatusChange(cov, "concluida")}>
                                <CheckCircle className="w-3 h-3 mr-1" />Concluir
                              </Button>
                            )}
                            {(cov.status === "agendada" || cov.status === "em_andamento") && (
                              <Button size="sm" variant="ghost" className="text-red-600 text-xs" onClick={() => handleStatusChange(cov, "cancelada")}>
                                <XCircle className="w-3 h-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(cov)} className="text-xs">Editar</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Nenhuma cobertura registrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-purple-600" />
              {editing ? "Editar Cobertura" : "Nova Cobertura de Posto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Posto/Lotação *</Label>
              <Select value={form.allocation_id} onValueChange={(v) => {
                const alloc = allocations.find(a => a.id === v);
                setForm({ ...form, allocation_id: v, client_id: alloc?.client_id || "" });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione a lotação" /></SelectTrigger>
                <SelectContent>
                  {allocations.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.post_name} — {clientMap[a.client_id]?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titular Ausente *</Label>
                <Select value={form.original_employee_id} onValueChange={(v) => setForm({ ...form, original_employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quem vai cobrir *</Label>
                <Select value={form.backup_employee_id} onValueChange={(v) => setForm({ ...form, backup_employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.id !== form.original_employee_id).map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início *</Label>
                <Input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Previsão de Término</Label>
                <Input type="datetime-local" value={form.end_datetime} onChange={(e) => setForm({ ...form, end_datetime: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                {editing ? "Salvar" : "Registrar Cobertura"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}