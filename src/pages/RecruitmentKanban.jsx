import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Mail, Phone, FileText, Linkedin, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { id: "triagem", label: "Triagem", color: "bg-gray-100 dark:bg-gray-800", headerColor: "border-gray-400" },
  { id: "entrevista_rh", label: "Entrevista RH", color: "bg-blue-50 dark:bg-blue-900/10", headerColor: "border-blue-400" },
  { id: "entrevista_tecnica", label: "Entrevista Técnica", color: "bg-purple-50 dark:bg-purple-900/10", headerColor: "border-purple-400" },
  { id: "entrevista_gestor", label: "Entrevista Gestor", color: "bg-orange-50 dark:bg-orange-900/10", headerColor: "border-orange-400" },
  { id: "proposta", label: "Proposta", color: "bg-yellow-50 dark:bg-yellow-900/10", headerColor: "border-yellow-400" },
  { id: "aprovado", label: "Aprovado ✓", color: "bg-green-50 dark:bg-green-900/10", headerColor: "border-green-500" },
  { id: "reprovado", label: "Reprovado", color: "bg-red-50 dark:bg-red-900/10", headerColor: "border-red-400" },
];

const SOURCE_LABELS = {
  linkedin: "LinkedIn", indicacao: "Indicação", site: "Site",
  whatsapp: "WhatsApp", email: "E-mail", outro: "Outro"
};

export default function RecruitmentKanban() {
  const [user, setUser] = useState(null);
  const [filterJob, setFilterJob] = useState("all");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [editNotes, setEditNotes] = useState("");

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

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }) => base44.entities.Candidate.update(id, { kanban_stage: stage }),
    onSuccess: () => { queryClient.invalidateQueries(["candidates"]); toast.success("Candidato movido!"); }
  });

  const updateNotesMutation = useMutation({
    mutationFn: ({ id, notes, rating }) => base44.entities.Candidate.update(id, { notes, rating }),
    onSuccess: () => { queryClient.invalidateQueries(["candidates"]); toast.success("Atualizado!"); setSelectedCandidate(null); }
  });

  const filtered = filterJob === "all"
    ? candidates
    : candidates.filter(c => c.job_position_id === filterJob);

  const getStageCount = (stageId) => filtered.filter(c => c.kanban_stage === stageId).length;

  const moveCandidate = (candidate, direction) => {
    const currentIdx = STAGES.findIndex(s => s.id === candidate.kanban_stage);
    const newIdx = currentIdx + direction;
    if (newIdx < 0 || newIdx >= STAGES.length) return;
    moveMutation.mutate({ id: candidate.id, stage: STAGES[newIdx].id });
  };

  const openDetails = (c) => {
    setSelectedCandidate(c);
    setEditNotes(c.notes || "");
  };

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
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kanban de Seleção</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie candidatos por etapa do processo</p>
        </div>
        <Select value={filterJob} onValueChange={setFilterJob}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filtrar por vaga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageCandidates = filtered.filter(c => c.kanban_stage === stage.id);
          return (
            <div key={stage.id} className={`flex-shrink-0 w-64 rounded-xl ${stage.color}`}>
              <div className={`px-3 py-2.5 border-b-2 ${stage.headerColor} flex items-center justify-between`}>
                <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{stage.label}</h3>
                <span className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold px-2 py-0.5 rounded-full">
                  {stageCandidates.length}
                </span>
              </div>
              <div className="p-2 space-y-2 min-h-32">
                {stageCandidates.map(c => {
                  const job = jobs.find(j => j.id === c.job_position_id);
                  const cInterviews = interviews.filter(i => i.candidate_id === c.id);
                  return (
                    <div
                      key={c.id}
                      className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => openDetails(c)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {c.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{c.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{c.current_position || "—"}</p>
                        </div>
                      </div>

                      {job && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 truncate mb-1.5">📋 {job.title}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star key={n} className={`w-3 h-3 ${n <= (c.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                          ))}
                        </div>
                        <div className="flex gap-1.5 items-center">
                          {cInterviews.length > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                              <CalendarCheck className="w-3 h-3" />{cInterviews.length}
                            </span>
                          )}
                          {c.source && (
                            <Badge variant="outline" className="text-xs px-1 py-0">{SOURCE_LABELS[c.source]}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Move buttons */}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => moveCandidate(c, -1)}
                          className="flex-1 flex items-center justify-center py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          disabled={STAGES.findIndex(s => s.id === c.kanban_stage) === 0}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveCandidate(c, 1)}
                          className="flex-1 flex items-center justify-center py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          disabled={STAGES.findIndex(s => s.id === c.kanban_stage) === STAGES.length - 1}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {stageCandidates.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Nenhum candidato</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                  {selectedCandidate.full_name?.charAt(0)}
                </div>
                {selectedCandidate.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedCandidate.email && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Mail className="w-3.5 h-3.5" /> {selectedCandidate.email}
                  </div>
                )}
                {selectedCandidate.phone && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Phone className="w-3.5 h-3.5" /> {selectedCandidate.phone}
                  </div>
                )}
                {selectedCandidate.expected_salary > 0 && (
                  <div className="text-green-700 font-medium">
                    💰 R$ {selectedCandidate.expected_salary?.toLocaleString("pt-BR")}
                  </div>
                )}
                {selectedCandidate.availability && (
                  <div className="text-gray-600 dark:text-gray-400">
                    🕐 {selectedCandidate.availability}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {selectedCandidate.resume_url && (
                  <a href={selectedCandidate.resume_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <FileText className="w-3.5 h-3.5" /> Currículo
                  </a>
                )}
                {selectedCandidate.linkedin_url && (
                  <a href={selectedCandidate.linkedin_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-700 hover:underline">
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Avaliação</Label>
                <StarRating
                  value={selectedCandidate.rating || 0}
                  onChange={v => setSelectedCandidate(prev => ({ ...prev, rating: v }))}
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Mover para etapa</Label>
                <Select
                  value={selectedCandidate.kanban_stage}
                  onValueChange={v => setSelectedCandidate(prev => ({ ...prev, kanban_stage: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Observações</Label>
                <Textarea
                  rows={3}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Anote aqui suas observações sobre o candidato..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600"
                  onClick={() => {
                    moveMutation.mutate({ id: selectedCandidate.id, stage: selectedCandidate.kanban_stage });
                    updateNotesMutation.mutate({ id: selectedCandidate.id, notes: editNotes, rating: selectedCandidate.rating });
                  }}
                >
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setSelectedCandidate(null)}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}