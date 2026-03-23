import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  Trash2, Edit, Download, RefreshCw, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, addDays, differenceInDays } from "date-fns";

export default function NR01UploadFlow({ user, contracts, clients, programs, onProgramSaved }) {
  const qc = useQueryClient();
  const pgrRef = useRef();
  const pcmsoRef = useRef();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ contract_id: "", safety_manager: "", safety_manager_crea: "", pgr_validity: "", pcmso_validity: "", pgr_file_url: "", pcmso_file_url: "", observations: "" });
  const [uploading, setUploading] = useState({});
  const [analyzing, setAnalyzing] = useState(null);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [step, setStep] = useState("form"); // form | processing | result

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const getContractLabel = (cid) => {
    const c = contracts.find(x => x.id === cid);
    if (!c) return "—";
    const cl = clients.find(x => x.id === c.client_id);
    return `${c.contract_number} — ${cl?.name || ""}`;
  };

  const isExpired = (d) => d && isBefore(new Date(d), new Date());
  const daysLeft = (d) => d ? differenceInDays(new Date(d), new Date()) : null;

  const getStatusBadge = (dateStr) => {
    const d = daysLeft(dateStr);
    if (!dateStr) return <Badge variant="outline">Sem data</Badge>;
    if (d < 0) return <Badge className="bg-red-100 text-red-800">Vencido</Badge>;
    if (d <= 30) return <Badge className="bg-red-100 text-red-800">Vence em {d}d</Badge>;
    if (d <= 90) return <Badge className="bg-yellow-100 text-yellow-800">Vence em {d}d</Badge>;
    return <Badge className="bg-green-100 text-green-800">Válido</Badge>;
  };

  const handleFileUpload = async (field, file) => {
    if (file.size > 25 * 1024 * 1024) { toast.error("Máximo 25MB por arquivo"); return; }
    setUploading(u => ({ ...u, [field]: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set(field, file_url);
      toast.success("Arquivo enviado com sucesso!");
    } catch (e) {
      toast.error("Erro no upload: " + e.message);
    }
    setUploading(u => ({ ...u, [field]: false }));
  };

  const handleDrop = (field, e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(field, file);
  };

  const handleSave = async () => {
    if (!form.contract_id) { toast.error("Selecione um contrato"); return; }
    try {
      let saved;
      if (editing) {
        saved = await base44.entities.ContractSafetyProgram.update(editing.id, form);
      } else {
        saved = await base44.entities.ContractSafetyProgram.create({ ...form, company_id: user.company_id });
      }
      qc.invalidateQueries(["safety_programs"]);
      toast.success("Programa salvo!");

      // Se tem arquivos, analisar
      const hasNewPgr = form.pgr_file_url && form.pgr_file_url !== editing?.pgr_file_url;
      const hasNewPcmso = form.pcmso_file_url && form.pcmso_file_url !== editing?.pcmso_file_url;
      if (hasNewPgr || hasNewPcmso) {
        await runAnalysis({
          contract_id: form.contract_id,
          company_id: user.company_id,
          pgr_file_url: hasNewPgr ? form.pgr_file_url : null,
          pcmso_file_url: hasNewPcmso ? form.pcmso_file_url : null,
          responsible: form.safety_manager || "",
        }, saved?.id || editing?.id);
      } else {
        resetForm();
      }
    } catch (e) {
      toast.error("Erro ao salvar: " + e.message);
    }
  };

  const runAnalysis = async (payload, programId) => {
    setAnalyzing(programId);
    setStep("processing");
    try {
      const res = await base44.functions.invoke("analyzeSafetyDocuments", payload);
      setAnalyzeResult(res.data);
      setStep("result");
      qc.invalidateQueries(["risks"]);
      qc.invalidateQueries(["actions"]);
      qc.invalidateQueries(["health_plans"]);
      qc.invalidateQueries(["sst_exames"]);
    } catch (e) {
      toast.error("Erro na análise: " + e.message);
      setStep("form");
    } finally {
      setAnalyzing(null);
    }
  };

  const resetForm = () => {
    setForm({ contract_id: "", safety_manager: "", safety_manager_crea: "", pgr_validity: "", pcmso_validity: "", pgr_file_url: "", pcmso_file_url: "", observations: "" });
    setEditing(null);
    setDialogOpen(false);
    setStep("form");
    setAnalyzeResult(null);
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({ contract_id: p.contract_id, safety_manager: p.safety_manager || "", safety_manager_crea: p.safety_manager_crea || "", pgr_validity: p.pgr_validity || "", pcmso_validity: p.pcmso_validity || "", pgr_file_url: p.pgr_file_url || "", pcmso_file_url: p.pcmso_file_url || "", observations: p.observations || "" });
    setStep("form");
    setDialogOpen(true);
  };

  const handleReanalyze = (p) => {
    if (!p.pgr_file_url && !p.pcmso_file_url) { toast.error("Nenhum arquivo vinculado"); return; }
    if (!confirm("Reler os documentos e criar novos registros? Registros existentes não serão apagados.")) return;
    runAnalysis({
      contract_id: p.contract_id,
      company_id: p.company_id || user?.company_id,
      pgr_file_url: p.pgr_file_url || null,
      pcmso_file_url: p.pcmso_file_url || null,
      responsible: p.safety_manager || "",
    }, p.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Programas PGR / PCMSO</h2>
          <p className="text-sm text-gray-500">Faça upload dos documentos e o sistema extrai automaticamente riscos, ações e exames.</p>
        </div>
        <Button className="gap-2" onClick={() => { setStep("form"); setDialogOpen(true); }}>
          <Upload className="w-4 h-4" /> Novo Programa
        </Button>
      </div>

      {/* Lista de programas */}
      <div className="grid gap-4">
        {programs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum programa cadastrado</p>
              <p className="text-sm mt-1">Cadastre o primeiro programa clicando em "Novo Programa"</p>
            </CardContent>
          </Card>
        )}
        {programs.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{getContractLabel(p.contract_id)}</h3>
                  {p.safety_manager && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {p.safety_manager}{p.safety_manager_crea ? ` — ${p.safety_manager_crea}` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">PGR:</span>
                      {getStatusBadge(p.pgr_validity)}
                      {p.pgr_file_url && (
                        <a href={p.pgr_file_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">PCMSO:</span>
                      {getStatusBadge(p.pcmso_validity)}
                      {p.pcmso_file_url && (
                        <a href={p.pcmso_file_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {analyzing === p.id && (
                    <span className="flex items-center gap-1 text-xs text-blue-600 mr-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...
                    </span>
                  )}
                  <Button
                    variant="outline" size="sm" className="gap-1 text-blue-700 border-blue-300"
                    disabled={analyzing === p.id || (!p.pgr_file_url && !p.pcmso_file_url)}
                    onClick={() => handleReanalyze(p)}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reler Docs
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(p)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Programa" : "Novo Programa NR-01"}</DialogTitle>
          </DialogHeader>

          {/* Step: processing */}
          {step === "processing" && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Analisando documentos com IA...</p>
                <p className="text-sm text-gray-500 mt-1">Extraindo riscos, ações, exames e treinamentos do PGR/PCMSO.</p>
                <p className="text-xs text-gray-400 mt-2">Isso pode levar 1-2 minutos dependendo do tamanho dos documentos.</p>
              </div>
            </div>
          )}

          {/* Step: result */}
          {step === "result" && analyzeResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Documentos processados com sucesso!</p>
                  <p className="text-sm text-green-700 mt-0.5">{analyzeResult.message}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Riscos mapeados", val: analyzeResult.risks_created, color: "orange" },
                  { label: "Ações criadas", val: analyzeResult.actions_created, color: "blue" },
                  { label: "Atividades PCMSO", val: analyzeResult.health_plans_created, color: "green" },
                  { label: "Não conformidades", val: analyzeResult.non_conformities_created, color: "red" },
                  { label: "Vínculos funcionários", val: analyzeResult.employees_linked, color: "purple" },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 border rounded-lg p-3 text-center">
                    <div className={`text-2xl font-bold text-${item.color}-600`}>{item.val ?? 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              {analyzeResult.errors?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-800 mb-1">Avisos:</p>
                  {analyzeResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-yellow-700">{e}</p>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={() => { resetForm(); onProgramSaved && onProgramSaved(form.contract_id); }}>
                  <ChevronRight className="w-4 h-4 mr-1" /> Ver Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* Step: form */}
          {step === "form" && (
            <div className="space-y-5">
              <div>
                <Label>Contrato *</Label>
                <select required className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.contract_id} onChange={e => set("contract_id", e.target.value)}>
                  <option value="">Selecione o contrato...</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Responsável Técnico</Label>
                  <Input className="mt-1" value={form.safety_manager} onChange={e => set("safety_manager", e.target.value)} placeholder="Eng. / Técnico SST" />
                </div>
                <div>
                  <Label>CREA / CRM</Label>
                  <Input className="mt-1" value={form.safety_manager_crea} onChange={e => set("safety_manager_crea", e.target.value)} />
                </div>
              </div>

              {/* PGR */}
              <div className="border rounded-xl p-4 bg-blue-50/50 space-y-3">
                <p className="font-semibold text-blue-800 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> PGR — Programa de Gerenciamento de Riscos
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Validade</Label>
                    <Input type="date" className="mt-1" value={form.pgr_validity} onChange={e => set("pgr_validity", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Arquivo PDF</Label>
                    <div
                      className="mt-1 border-2 border-dashed border-blue-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      onClick={() => pgrRef.current?.click()}
                      onDrop={e => handleDrop("pgr_file_url", e)}
                      onDragOver={e => e.preventDefault()}
                    >
                      {uploading.pgr_file_url ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-500" />
                      ) : form.pgr_file_url ? (
                        <div className="flex items-center justify-center gap-1 text-green-600 text-xs">
                          <CheckCircle2 className="w-4 h-4" /> Arquivo enviado
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          <Upload className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                          Clique ou arraste o PDF
                        </div>
                      )}
                    </div>
                    <input ref={pgrRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files[0] && handleFileUpload("pgr_file_url", e.target.files[0])} />
                  </div>
                </div>
              </div>

              {/* PCMSO */}
              <div className="border rounded-xl p-4 bg-green-50/50 space-y-3">
                <p className="font-semibold text-green-800 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> PCMSO — Programa de Controle Médico de Saúde Ocupacional
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Validade</Label>
                    <Input type="date" className="mt-1" value={form.pcmso_validity} onChange={e => set("pcmso_validity", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Arquivo PDF</Label>
                    <div
                      className="mt-1 border-2 border-dashed border-green-300 rounded-lg p-3 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                      onClick={() => pcmsoRef.current?.click()}
                      onDrop={e => handleDrop("pcmso_file_url", e)}
                      onDragOver={e => e.preventDefault()}
                    >
                      {uploading.pcmso_file_url ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-green-500" />
                      ) : form.pcmso_file_url ? (
                        <div className="flex items-center justify-center gap-1 text-green-600 text-xs">
                          <CheckCircle2 className="w-4 h-4" /> Arquivo enviado
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          <Upload className="w-5 h-5 mx-auto mb-1 text-green-400" />
                          Clique ou arraste o PDF
                        </div>
                      )}
                    </div>
                    <input ref={pcmsoRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files[0] && handleFileUpload("pcmso_file_url", e.target.files[0])} />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                💡 Após salvar, o sistema irá <strong>ler automaticamente os PDFs com IA</strong> e extrair: riscos, plano de ação, exames médicos e treinamentos exigidos.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button onClick={handleSave} disabled={!form.contract_id}>
                  {form.pgr_file_url || form.pcmso_file_url ? "Salvar e Processar com IA" : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}