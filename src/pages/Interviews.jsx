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
import {
  CalendarCheck, Plus, Edit, Trash2, Star, Video, Phone, MapPin,
  User, BarChart3, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_COLORS = {
  agendada: "bg-blue-100 text-blue-700",
  realizada: "bg-green-100 text-green-700",
  cancelada: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700"
};

const TYPE_LABELS = {
  triagem: "Triagem", rh: "RH", tecnica: "Técnica", gestor: "Gestor", final: "Final"
};

const FORMAT_ICONS = {
  presencial: MapPin, video: Video, telefone: Phone
};

const emptyForm = {
  candidate_id: "", job_position_id: "", interview_type: "rh",
  scheduled_date: "", scheduled_time: "", interviewer_email: "",
  interviewer_name: "", format: "video", meeting_link: "",
  status: "agendada", rating: 0, feedback: "", recommendation: "pendente", duration_minutes: 60
};

export default function Interviews() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterJob, setFilterJob] = useState("all");
  const [formData, setFormData] = useState(emptyForm);
  const [showChart, setShowChart] = useState(false);

  const queryClient = useQueryClient();
  useEffect(() => { loadUser(); }, []);
  const loadUser = async () => { const u = await base44.auth.me(); setUser(u); };

  const { data: interviews = [] } = useQuery({
    queryKey: ["interviews", user?.company_id],
    queryFn: () => base44.entities.Interview.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates", user?.company_id],
    queryFn: () => base44.entities.Candidate.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobPositions", user?.company_id],
    queryFn: () => base44.entities.JobPosition.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Interview.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { queryClient.invalidateQueries(["interviews"]); toast.success("Entrevista agendada!"); setDialogOpen(false); setFormData(emptyForm); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Interview.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["interviews"]); toast.success("Entrevista atualizada!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Interview.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(["interviews"]); toast.success("Entrevista excluída!"); }
  });

  const handleEdit = (iv) => {
    setEditing(iv);
    setFormData({ ...emptyForm, ...iv });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, rating: parseInt(formData.rating) || 0, duration_minutes: parseInt(formData.duration_minutes) || 60 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = interviews.filter(iv => {
    const matchStatus = filterStatus === "all" || iv.status === filterStatus;
    const matchJob = filterJob === "all" || iv.job_position_id === filterJob;
    return matchStatus && matchJob;
  }).sort((a, b) => b.scheduled_date?.localeCompare(a.scheduled_date));

  // Chart: interviews per day last 30 days
  const last30 = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
  const chartData = last30.map(day => {
    const dateStr = format(day, "yyyy-MM-dd");
    return {
      date: format(day, "dd/MM"),
      realizadas: interviews.filter(i => i.scheduled_date === dateStr && i.status === "realizada").length,
      agendadas: interviews.filter(i => i.scheduled_date === dateStr && i.status === "agendada").length,
    };
  });

  // Chart: by job
  const byJobData = jobs.map(j => ({
    name: j.title.length > 18 ? j.title.substring(0, 18) + "…" : j.title,
    realizadas: interviews.filter(i => i.job_position_id === j.id && i.status === "realizada").length,
    agendadas: interviews.filter(i => i.job_position_id === j.id && i.status === "agendada").length,
  })).filter(d => d.realizadas + d.agendadas > 0);

  const StarRating = ({ value, onChange }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange && onChange(n)}>
          <Star className={`w-4 h-4 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6" /> Entrevistas
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {interviews.filter(i => i.status === "agendada").length} agendadas ·{" "}
            {interviews.filter(i => i.status === "realizada").length} realizadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowChart(p => !p)}>
            <BarChart3 className="w-4 h-4 mr-2" /> Analytics
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setFormData(emptyForm); }} className="bg-gradient-to-r from-purple-600 to-blue-600">
                <Plus className="w-4 h-4 mr-2" /> Agendar Entrevista
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar Entrevista" : "Agendar Entrevista"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Candidato *</Label>
                  <Select value={formData.candidate_id} onValueChange={v => setFormData({ ...formData, candidate_id: v })} required>
                    <SelectTrigger><SelectValue placeholder="Selecione o candidato" /></SelectTrigger>
                    <SelectContent>
                      {candidates.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vaga *</Label>
                  <Select value={formData.job_position_id} onValueChange={v => setFormData({ ...formData, job_position_id: v })} required>
                    <SelectTrigger><SelectValue placeholder="Selecione a vaga" /></SelectTrigger>
                    <SelectContent>
                      {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={formData.interview_type} onValueChange={v => setFormData({ ...formData, interview_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Formato</Label>
                    <Select value={formData.format} onValueChange={v => setFormData({ ...formData, format: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presencial">Presencial</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data *</Label>
                    <Input type="date" value={formData.scheduled_date} onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Horário</Label>
                    <Input type="time" value={formData.scheduled_time} onChange={e => setFormData({ ...formData, scheduled_time: e.target.value })} />
                  </div>
                  <div>
                    <Label>Entrevistador</Label>
                    <Input value={formData.interviewer_name} onChange={e => setFormData({ ...formData, interviewer_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agendada">Agendada</SelectItem>
                        <SelectItem value="realizada">Realizada</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                        <SelectItem value="no_show">No-show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formData.format === "video" && (
                  <div>
                    <Label>Link da Reunião</Label>
                    <Input value={formData.meeting_link} onChange={e => setFormData({ ...formData, meeting_link: e.target.value })} placeholder="https://meet.google.com/..." />
                  </div>
                )}
                {formData.status === "realizada" && (
                  <>
                    <div>
                      <Label>Avaliação</Label>
                      <div className="mt-1">
                        <StarRating value={formData.rating} onChange={v => setFormData({ ...formData, rating: v })} />
                      </div>
                    </div>
                    <div>
                      <Label>Recomendação</Label>
                      <Select value={formData.recommendation} onValueChange={v => setFormData({ ...formData, recommendation: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="reprovado">Reprovado</SelectItem>
                          <SelectItem value="proxima_fase">Próxima Fase</SelectItem>
                          <SelectItem value="pendente">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Feedback</Label>
                      <Textarea rows={3} value={formData.feedback} onChange={e => setFormData({ ...formData, feedback: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600">
                    {editing ? "Atualizar" : "Agendar"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Analytics */}
      {showChart && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Entrevistas por dia (últimos 30 dias)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="realizadas" fill="#7c3aed" radius={[3, 3, 0, 0]} name="Realizadas" />
                  <Bar dataKey="agendadas" fill="#93c5fd" radius={[3, 3, 0, 0]} name="Agendadas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Entrevistas por vaga</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byJobData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="realizadas" fill="#7c3aed" radius={[0, 3, 3, 0]} name="Realizadas" />
                  <Bar dataKey="agendadas" fill="#93c5fd" radius={[0, 3, 3, 0]} name="Agendadas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="agendada">Agendada</SelectItem>
            <SelectItem value="realizada">Realizada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterJob} onValueChange={setFilterJob}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(iv => {
          const candidate = candidates.find(c => c.id === iv.candidate_id);
          const job = jobs.find(j => j.id === iv.job_position_id);
          const FormatIcon = FORMAT_ICONS[iv.format] || Video;
          return (
            <Card key={iv.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {candidate?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{candidate?.full_name || "Candidato N/A"}</p>
                      <p className="text-xs text-gray-500">{job?.title || "Vaga N/A"} · {TYPE_LABELS[iv.interview_type]}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{iv.scheduled_date}</p>
                      <p className="text-xs text-gray-500">{iv.scheduled_time || "—"}</p>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <FormatIcon className="w-3.5 h-3.5" /> {iv.format}
                    </div>

                    {iv.interviewer_name && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <User className="w-3.5 h-3.5" /> {iv.interviewer_name}
                      </div>
                    )}

                    <Badge className={`text-xs ${STATUS_COLORS[iv.status]}`}>{iv.status}</Badge>

                    {iv.status === "realizada" && iv.rating > 0 && (
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={`w-3.5 h-3.5 ${n <= iv.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                    )}

                    {iv.recommendation && iv.recommendation !== "pendente" && (
                      <Badge variant="outline" className={`text-xs ${iv.recommendation === "aprovado" ? "text-green-700 border-green-300" : iv.recommendation === "reprovado" ? "text-red-700 border-red-300" : ""}`}>
                        {iv.recommendation === "proxima_fase" ? "Próx. fase" : iv.recommendation}
                      </Badge>
                    )}

                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(iv)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(iv.id); }}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
                {iv.feedback && (
                  <p className="text-xs text-gray-500 mt-2 pl-12 italic">"{iv.feedback}"</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">Nenhuma entrevista encontrada</div>
        )}
      </div>
    </div>
  );
}