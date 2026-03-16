import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Plus, Edit, Trash2, Users, CalendarCheck, Search } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  rascunho: "bg-gray-100 text-gray-600",
  aberta: "bg-green-100 text-green-700",
  pausada: "bg-yellow-100 text-yellow-700",
  encerrada: "bg-red-100 text-red-600"
};

const PRIORITY_COLORS = {
  baixa: "bg-blue-100 text-blue-700",
  media: "bg-gray-100 text-gray-600",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700"
};

export default function JobPositions() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    title: "", description: "", requirements: "",
    salary_min: "", salary_max: "", location: "",
    work_type: "presencial", contract_type: "clt",
    status: "aberta", priority: "media",
    openings: 1, deadline: "", responsible_email: "", notes: ""
  });

  const queryClient = useQueryClient();
  useEffect(() => { loadUser(); }, []);
  const loadUser = async () => { const u = await base44.auth.me(); setUser(u); };

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobPositions", user?.company_id],
    queryFn: () => base44.entities.JobPosition.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates", user?.company_id],
    queryFn: () => base44.entities.Candidate.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: interviews = [] } = useQuery({
    queryKey: ["interviews", user?.company_id],
    queryFn: () => base44.entities.Interview.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.JobPosition.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { queryClient.invalidateQueries(["jobPositions"]); toast.success("Vaga criada!"); setDialogOpen(false); reset(); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.JobPosition.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["jobPositions"]); toast.success("Vaga atualizada!"); setDialogOpen(false); reset(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.JobPosition.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(["jobPositions"]); toast.success("Vaga excluída!"); }
  });

  const reset = () => {
    setEditing(null);
    setFormData({
      title: "", description: "", requirements: "",
      salary_min: "", salary_max: "", location: "",
      work_type: "presencial", contract_type: "clt",
      status: "aberta", priority: "media",
      openings: 1, deadline: "", responsible_email: "", notes: ""
    });
  };

  const handleEdit = (job) => {
    setEditing(job);
    setFormData({
      title: job.title || "", description: job.description || "",
      requirements: job.requirements || "", salary_min: job.salary_min || "",
      salary_max: job.salary_max || "", location: job.location || "",
      work_type: job.work_type || "presencial", contract_type: job.contract_type || "clt",
      status: job.status || "aberta", priority: job.priority || "media",
      openings: job.openings || 1, deadline: job.deadline || "",
      responsible_email: job.responsible_email || "", notes: job.notes || ""
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      salary_min: parseFloat(formData.salary_min) || 0,
      salary_max: parseFloat(formData.salary_max) || 0,
      openings: parseInt(formData.openings) || 1
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || j.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Briefcase className="w-6 h-6" /> Vagas em Aberto
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{jobs.filter(j => j.status === "aberta").length} vaga(s) ativa(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={reset} className="bg-gradient-to-r from-purple-600 to-blue-600">
              <Plus className="w-4 h-4 mr-2" /> Nova Vaga
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Vaga" : "Nova Vaga"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Título da Vaga *</Label>
                <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                      <SelectItem value="encerrada">Encerrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Contrato</Label>
                  <Select value={formData.contract_type} onValueChange={v => setFormData({ ...formData, contract_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="pj">PJ</SelectItem>
                      <SelectItem value="estagio">Estágio</SelectItem>
                      <SelectItem value="temporario">Temporário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modalidade</Label>
                  <Select value={formData.work_type} onValueChange={v => setFormData({ ...formData, work_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="remoto">Remoto</SelectItem>
                      <SelectItem value="hibrido">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Salário Mínimo</Label>
                  <Input type="number" placeholder="0.00" value={formData.salary_min} onChange={e => setFormData({ ...formData, salary_min: e.target.value })} />
                </div>
                <div>
                  <Label>Salário Máximo</Label>
                  <Input type="number" placeholder="0.00" value={formData.salary_max} onChange={e => setFormData({ ...formData, salary_max: e.target.value })} />
                </div>
                <div>
                  <Label>Número de Vagas</Label>
                  <Input type="number" min="1" value={formData.openings} onChange={e => setFormData({ ...formData, openings: e.target.value })} />
                </div>
                <div>
                  <Label>Data Limite</Label>
                  <Input type="date" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Localização</Label>
                <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div>
                <Label>Responsável (email)</Label>
                <Input type="email" value={formData.responsible_email} onChange={e => setFormData({ ...formData, responsible_email: e.target.value })} />
              </div>
              <div>
                <Label>Descrição da Vaga</Label>
                <Textarea rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <Label>Requisitos</Label>
                <Textarea rows={3} value={formData.requirements} onChange={e => setFormData({ ...formData, requirements: e.target.value })} />
              </div>
              <div>
                <Label>Observações Internas</Label>
                <Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600">
                  {editing ? "Atualizar" : "Criar"} Vaga
                </Button>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); reset(); }}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar vagas..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="pausada">Pausada</SelectItem>
            <SelectItem value="encerrada">Encerrada</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(job => {
          const jobCandidates = candidates.filter(c => c.job_position_id === job.id);
          const jobInterviews = interviews.filter(i => i.job_position_id === job.id);
          return (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{job.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{job.location || "Localização não informada"}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(job)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("Excluir vaga?")) deleteMutation.mutate(job.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge className={`text-xs ${STATUS_COLORS[job.status]}`}>{job.status}</Badge>
                  <Badge className={`text-xs ${PRIORITY_COLORS[job.priority]}`}>{job.priority}</Badge>
                  <Badge variant="outline" className="text-xs">{job.contract_type?.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-xs">{job.work_type}</Badge>
                </div>

                {(job.salary_min || job.salary_max) && (
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-3">
                    R$ {job.salary_min?.toLocaleString("pt-BR")} – R$ {job.salary_max?.toLocaleString("pt-BR")}
                  </p>
                )}

                <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {jobCandidates.length} candidatos
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarCheck className="w-3.5 h-3.5" /> {jobInterviews.length} entrevistas
                  </span>
                  {job.openings > 1 && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" /> {job.openings} vagas
                    </span>
                  )}
                </div>

                {job.deadline && (
                  <p className="text-xs text-orange-600 mt-2">Prazo: {job.deadline}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-500">Nenhuma vaga encontrada</div>
        )}
      </div>
    </div>
  );
}