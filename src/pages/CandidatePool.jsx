import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Plus, Edit, Trash2, Search, Upload, Star, Phone,
  Mail, MapPin, Linkedin, FileText, ExternalLink
} from "lucide-react";
import { toast } from "sonner";

const STAGE_COLORS = {
  triagem: "bg-gray-100 text-gray-700",
  entrevista_rh: "bg-blue-100 text-blue-700",
  entrevista_tecnica: "bg-purple-100 text-purple-700",
  entrevista_gestor: "bg-orange-100 text-orange-700",
  proposta: "bg-yellow-100 text-yellow-700",
  aprovado: "bg-green-100 text-green-700",
  reprovado: "bg-red-100 text-red-600",
  desistiu: "bg-gray-200 text-gray-500"
};

const SOURCE_LABELS = {
  linkedin: "LinkedIn", indicacao: "Indicação", site: "Site",
  whatsapp: "WhatsApp", email: "E-mail", outro: "Outro"
};

const emptyForm = {
  full_name: "", email: "", phone: "", cpf: "", birth_date: "",
  address_city: "", address_state: "", linkedin_url: "", resume_url: "",
  education_level: "", current_company: "", current_position: "",
  expected_salary: "", availability: "", source: "outro",
  kanban_stage: "triagem", rating: 0, notes: "", job_position_id: "", is_pool: false
};

export default function CandidatePool() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterJob, setFilterJob] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const fileRef = useRef();

  const queryClient = useQueryClient();
  useEffect(() => { loadUser(); }, []);
  const loadUser = async () => { const u = await base44.auth.me(); setUser(u); };

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

  const { data: interviews = [] } = useQuery({
    queryKey: ["interviews", user?.company_id],
    queryFn: () => base44.entities.Interview.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Candidate.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { queryClient.invalidateQueries(["candidates"]); toast.success("Candidato adicionado!"); setDialogOpen(false); setFormData(emptyForm); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Candidate.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["candidates"]); toast.success("Candidato atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Candidate.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(["candidates"]); toast.success("Candidato excluído!"); }
  });

  const handleUploadResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData(prev => ({ ...prev, resume_url: file_url }));
    setUploading(false);
    toast.success("Currículo enviado!");
  };

  const handleEdit = (c) => {
    setEditing(c);
    setFormData({ ...emptyForm, ...c });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, expected_salary: parseFloat(formData.expected_salary) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = candidates.filter(c => {
    const matchSearch = c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchStage = filterStage === "all" || c.kanban_stage === filterStage;
    const matchJob = filterJob === "all" || c.job_position_id === filterJob;
    return matchSearch && matchStage && matchJob;
  });

  const StarRating = ({ value, onChange }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star className={`w-5 h-5 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users className="w-6 h-6" /> Banco de Currículos
          </h1>
          <p className="text-gray-500 text-sm mt-1">{candidates.length} candidatos cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setFormData(emptyForm); }} className="bg-gradient-to-r from-purple-600 to-blue-600">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Candidato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Candidato" : "Novo Candidato"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs defaultValue="pessoal">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
                  <TabsTrigger value="profissional">Profissional</TabsTrigger>
                  <TabsTrigger value="processo">Processo</TabsTrigger>
                </TabsList>
                <TabsContent value="pessoal" className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Nome completo *</Label>
                      <Input value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} required />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                    <div>
                      <Label>Cidade</Label>
                      <Input value={formData.address_city} onChange={e => setFormData({ ...formData, address_city: e.target.value })} />
                    </div>
                    <div>
                      <Label>Estado</Label>
                      <Input value={formData.address_state} onChange={e => setFormData({ ...formData, address_state: e.target.value })} maxLength={2} />
                    </div>
                    <div className="col-span-2">
                      <Label>LinkedIn</Label>
                      <Input value={formData.linkedin_url} onChange={e => setFormData({ ...formData, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="profissional" className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Empresa Atual</Label>
                      <Input value={formData.current_company} onChange={e => setFormData({ ...formData, current_company: e.target.value })} />
                    </div>
                    <div>
                      <Label>Cargo Atual</Label>
                      <Input value={formData.current_position} onChange={e => setFormData({ ...formData, current_position: e.target.value })} />
                    </div>
                    <div>
                      <Label>Escolaridade</Label>
                      <Select value={formData.education_level} onValueChange={v => setFormData({ ...formData, education_level: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fundamental">Fundamental</SelectItem>
                          <SelectItem value="medio">Médio</SelectItem>
                          <SelectItem value="superior_incompleto">Superior Incompleto</SelectItem>
                          <SelectItem value="superior_completo">Superior Completo</SelectItem>
                          <SelectItem value="pos_graduacao">Pós-Graduação</SelectItem>
                          <SelectItem value="mestrado">Mestrado</SelectItem>
                          <SelectItem value="doutorado">Doutorado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Pretensão Salarial (R$)</Label>
                      <Input type="number" value={formData.expected_salary} onChange={e => setFormData({ ...formData, expected_salary: e.target.value })} />
                    </div>
                    <div>
                      <Label>Disponibilidade</Label>
                      <Input value={formData.availability} onChange={e => setFormData({ ...formData, availability: e.target.value })} placeholder="Ex: imediata, 30 dias..." />
                    </div>
                    <div>
                      <Label>Canal de Captação</Label>
                      <Select value={formData.source} onValueChange={v => setFormData({ ...formData, source: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Currículo (PDF)</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <input type="file" accept=".pdf,.doc,.docx" ref={fileRef} onChange={handleUploadResume} className="hidden" />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                          <Upload className="w-3.5 h-3.5 mr-1" />
                          {uploading ? "Enviando..." : "Enviar arquivo"}
                        </Button>
                        {formData.resume_url && (
                          <a href={formData.resume_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Ver currículo
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="processo" className="space-y-3 pt-3">
                  <div>
                    <Label>Vaga</Label>
                    <Select value={formData.job_position_id || "pool"} onValueChange={v => setFormData({ ...formData, job_position_id: v === "pool" ? "" : v, is_pool: v === "pool" })}>
                      <SelectTrigger><SelectValue placeholder="Selecione a vaga" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pool">Banco de Talentos (sem vaga específica)</SelectItem>
                        {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estágio no Processo</Label>
                    <Select value={formData.kanban_stage} onValueChange={v => setFormData({ ...formData, kanban_stage: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="triagem">Triagem</SelectItem>
                        <SelectItem value="entrevista_rh">Entrevista RH</SelectItem>
                        <SelectItem value="entrevista_tecnica">Entrevista Técnica</SelectItem>
                        <SelectItem value="entrevista_gestor">Entrevista Gestor</SelectItem>
                        <SelectItem value="proposta">Proposta</SelectItem>
                        <SelectItem value="aprovado">Aprovado</SelectItem>
                        <SelectItem value="reprovado">Reprovado</SelectItem>
                        <SelectItem value="desistiu">Desistiu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Avaliação</Label>
                    <div className="mt-1">
                      <StarRating value={formData.rating} onChange={v => setFormData({ ...formData, rating: v })} />
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600">
                  {editing ? "Atualizar" : "Adicionar"} Candidato
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar candidatos..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterJob} onValueChange={setFilterJob}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as vagas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            <SelectItem value="pool">Banco de Talentos</SelectItem>
            {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos os estágios" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estágios</SelectItem>
            <SelectItem value="triagem">Triagem</SelectItem>
            <SelectItem value="entrevista_rh">Entrevista RH</SelectItem>
            <SelectItem value="entrevista_tecnica">Entrevista Técnica</SelectItem>
            <SelectItem value="entrevista_gestor">Entrevista Gestor</SelectItem>
            <SelectItem value="proposta">Proposta</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="reprovado">Reprovado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => {
          const job = jobs.find(j => j.id === c.job_position_id);
          const candidateInterviews = interviews.filter(i => i.candidate_id === c.id);
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {c.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{c.full_name}</p>
                      <p className="text-xs text-gray-500">{c.current_position || "Cargo não informado"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(c)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(c.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge className={`text-xs ${STAGE_COLORS[c.kanban_stage] || "bg-gray-100 text-gray-600"}`}>
                    {c.kanban_stage?.replace("_", " ")}
                  </Badge>
                  {c.source && (
                    <Badge variant="outline" className="text-xs">{SOURCE_LABELS[c.source]}</Badge>
                  )}
                </div>

                {job && (
                  <p className="text-xs text-purple-700 dark:text-purple-400 mb-2 font-medium truncate">
                    📋 {job.title}
                  </p>
                )}
                {c.is_pool && !job && (
                  <p className="text-xs text-blue-600 mb-2">🏊 Banco de Talentos</p>
                )}

                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {c.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</p>}
                  {c.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                  {(c.address_city || c.address_state) && (
                    <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {[c.address_city, c.address_state].filter(Boolean).join(", ")}</p>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= (c.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {candidateInterviews.length > 0 && (
                      <span className="text-xs text-gray-500">{candidateInterviews.length} entrevista(s)</span>
                    )}
                    {c.resume_url && (
                      <a href={c.resume_url} target="_blank" rel="noreferrer">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </a>
                    )}
                    {c.linkedin_url && (
                      <a href={c.linkedin_url} target="_blank" rel="noreferrer">
                        <Linkedin className="w-4 h-4 text-blue-700" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-500">Nenhum candidato encontrado</div>
        )}
      </div>
    </div>
  );
}