import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Plus, Edit, Trash2, AlertTriangle, FileText, Download, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, addDays } from "date-fns";

export default function SafetyPrograms() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState({});
  const [analyzing, setAnalyzing] = useState(null);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [pendingAnalysis, setPendingAnalysis] = useState(null); // { pgr, pcmso, contract_id } para analisar após save
  const [formData, setFormData] = useState({ contract_id: "", pgr_file_url: "", pcmso_file_url: "", pgr_validity: "", pcmso_validity: "", safety_manager: "", safety_manager_crea: "", observations: "" });

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();

  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list(), enabled: !!user });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), enabled: !!user });
  const { data: programs = [] } = useQuery({ queryKey: ["safety_programs"], queryFn: () => base44.entities.ContractSafetyProgram.list(), enabled: !!user });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.ContractSafetyProgram.update(editing.id, data)
      : base44.entities.ContractSafetyProgram.create({ ...data, company_id: user.company_id }),
    onSuccess: async (savedProgram, variables) => {
      qc.invalidateQueries(["safety_programs"]);
      toast.success("Programa salvo!");
      // Verifica se há arquivos novos para analisar
      const pgr = variables.pgr_file_url;
      const pcmso = variables.pcmso_file_url;
      const oldPgr = editing?.pgr_file_url;
      const oldPcmso = editing?.pcmso_file_url;
      const hasNewPgr = pgr && pgr !== oldPgr;
      const hasNewPcmso = pcmso && pcmso !== oldPcmso;
      const programId = savedProgram?.id || editing?.id;
      resetForm();
      if (hasNewPgr || hasNewPcmso) {
        await runAnalysis({
          program_id: programId,
          contract_id: variables.contract_id,
          company_id: user.company_id,
          pgr_file_url: hasNewPgr ? pgr : null,
          pcmso_file_url: hasNewPcmso ? pcmso : null,
          responsible: variables.safety_manager || '',
        }, programId);
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContractSafetyProgram.delete(id),
    onSuccess: () => { qc.invalidateQueries(["safety_programs"]); toast.success("Programa removido!"); }
  });

  const runAnalysis = async (payload, programId) => {
    setAnalyzeResult(null);
    setAnalyzing(programId);
    toast.info('Lendo documentos PGR/PCMSO e criando registros... Aguarde.');
    try {
      const res = await base44.functions.invoke('analyzeSafetyDocuments', payload);
      setAnalyzeResult(res.data);
      qc.invalidateQueries(["safety_programs"]);
      toast.success(res.data?.message || 'Leitura concluída!');
    } catch (err) {
      toast.error('Erro na leitura dos documentos: ' + err.message);
    } finally {
      setAnalyzing(null);
    }
  };

  const resetForm = () => { setFormData({ contract_id: "", pgr_file_url: "", pcmso_file_url: "", pgr_validity: "", pcmso_validity: "", safety_manager: "", safety_manager_crea: "", observations: "" }); setEditing(null); setDialogOpen(false); };

  const handleEdit = (p) => { setEditing(p); setFormData({ contract_id: p.contract_id, pgr_file_url: p.pgr_file_url || "", pcmso_file_url: p.pcmso_file_url || "", pgr_validity: p.pgr_validity || "", pcmso_validity: p.pcmso_validity || "", safety_manager: p.safety_manager || "", safety_manager_crea: p.safety_manager_crea || "", observations: p.observations || "" }); setDialogOpen(true); };

  const handleFileUpload = async (field, file) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo permitido: 20MB');
      return;
    }
    setUploading(u => ({ ...u, [field]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData(f => ({ ...f, [field]: file_url }));
    setUploading(u => ({ ...u, [field]: false }));
    // Se estiver editando programa existente com contrato, analisar imediatamente
    if (editing && editing.contract_id) {
      const isPgr = field === 'pgr_file_url';
      toast.success('Arquivo enviado! Iniciando leitura do documento...');
      await runAnalysis({
        program_id: editing.id,
        contract_id: editing.contract_id,
        company_id: editing.company_id || user.company_id,
        pgr_file_url: isPgr ? file_url : null,
        pcmso_file_url: !isPgr ? file_url : null,
        responsible: editing.safety_manager || '',
      }, editing.id);
    } else {
      toast.success('Arquivo enviado! Será processado ao salvar o programa.');
    }
  };

  const getContractLabel = (cid) => {
    const c = contracts.find(x => x.id === cid);
    if (!c) return "—";
    const client = clients.find(x => x.id === c.client_id);
    return `${c.contract_number} — ${client?.name || ""}`;
  };

  const isExpiring = (dateStr) => dateStr && isBefore(new Date(dateStr), addDays(new Date(), 30));
  const isExpired = (dateStr) => dateStr && isBefore(new Date(dateStr), new Date());

  const getStatusBadge = (dateStr) => {
    if (!dateStr) return <Badge variant="outline">Sem data</Badge>;
    if (isExpired(dateStr)) return <Badge variant="destructive">Vencido</Badge>;
    if (isExpiring(dateStr)) return <Badge className="bg-yellow-100 text-yellow-800">Vencendo</Badge>;
    return <Badge className="bg-green-100 text-green-800">Válido</Badge>;
  };



  // Contratos sem programa cadastrado
  const contractsWithProgram = programs.map(p => p.contract_id);
  const contractsWithoutProgram = contracts.filter(c => !contractsWithProgram.includes(c.id));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contratos e Programas</h1>
            <p className="text-gray-500 text-sm">PGR e PCMSO por contrato</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Programa
        </Button>
      </div>

      {contractsWithoutProgram.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span className="text-amber-700">{contractsWithoutProgram.length} contrato(s) sem programa de segurança cadastrado.</span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato / Cliente</TableHead>
                <TableHead>Responsável Técnico</TableHead>
                <TableHead>PGR</TableHead>
                <TableHead>PCMSO</TableHead>
                <TableHead className="text-right">Ações</TableHead>
                </TableRow>
                </TableHeader>
            <TableBody>
              {programs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nenhum programa cadastrado</TableCell></TableRow>
              )}
              {programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{getContractLabel(p.contract_id)}</TableCell>
                  <TableCell>
                    <div className="text-sm">{p.safety_manager || "—"}</div>
                    {p.safety_manager_crea && <div className="text-xs text-gray-400">{p.safety_manager_crea}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(p.pgr_validity)}
                      {p.pgr_validity && <span className="text-xs text-gray-500">{format(new Date(p.pgr_validity), "dd/MM/yyyy")}</span>}
                      {p.pgr_file_url && <a href={p.pgr_file_url} target="_blank" rel="noreferrer"><Download className="w-4 h-4 text-blue-500" /></a>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(p.pcmso_validity)}
                      {p.pcmso_validity && <span className="text-xs text-gray-500">{format(new Date(p.pcmso_validity), "dd/MM/yyyy")}</span>}
                      {p.pcmso_file_url && <a href={p.pcmso_file_url} target="_blank" rel="noreferrer"><Download className="w-4 h-4 text-blue-500" /></a>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 items-center">
                      {analyzing === p.id && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Processando...
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                        disabled={analyzing === p.id || (!p.pgr_file_url && !p.pcmso_file_url)}
                        onClick={() => {
                          if (!confirm(`Ler os documentos do contrato ${getContractLabel(p.contract_id)} e criar riscos/ações/atividades?\n\nRegistros existentes NÃO serão apagados.`)) return;
                          runAnalysis({
                            program_id: p.id,
                            contract_id: p.contract_id,
                            company_id: p.company_id || user.company_id,
                            pgr_file_url: p.pgr_file_url || null,
                            pcmso_file_url: p.pcmso_file_url || null,
                            responsible: p.safety_manager || '',
                          }, p.id);
                        }}
                        title={(!p.pgr_file_url && !p.pcmso_file_url) ? 'Nenhum arquivo vinculado' : 'Ler documentos e criar registros'}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {analyzing === p.id ? 'Lendo...' : 'Ler Docs'}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Excluir este programa?')) deleteMutation.mutate(p.id); }}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                  </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resultado da análise */}
      {analyzeResult && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-green-800 text-sm">{analyzeResult.message}</p>
            <div className="flex gap-4 mt-2 text-xs text-green-700">
              <span>🔴 {analyzeResult.risks_created} riscos criados</span>
              <span>📋 {analyzeResult.actions_created} ações criadas</span>
              <span>🏥 {analyzeResult.health_plans_created} atividades PCMSO criadas</span>
            </div>
            {analyzeResult.errors?.length > 0 && (
              <div className="mt-2 text-xs text-red-600">
                {analyzeResult.errors.map((e, i) => <p key={i}>⚠️ {e}</p>)}
              </div>
            )}
            <p className="mt-2 text-xs text-green-600">Acesse "Inventário de Riscos", "Plano de Ação (PGR)" e "Atividades de Saúde (PCMSO)" para ver os registros gerados.</p>
          </div>
          <button className="text-green-600 hover:text-green-800 text-xs" onClick={() => setAnalyzeResult(null)}>✕</button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Programa" : "Novo Programa de Segurança"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
            <div>
              <Label>Contrato *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm" value={formData.contract_id} onChange={e => setFormData(f => ({ ...f, contract_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Responsável Técnico</Label>
                <Input value={formData.safety_manager} onChange={e => setFormData(f => ({ ...f, safety_manager: e.target.value }))} placeholder="Nome do SESMT/Engenheiro" />
              </div>
              <div>
                <Label>CREA / CRM</Label>
                <Input value={formData.safety_manager_crea} onChange={e => setFormData(f => ({ ...f, safety_manager_crea: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-blue-50">
              <div className="col-span-2 font-semibold text-blue-800 text-sm">PGR — Programa de Gerenciamento de Riscos</div>
              <div>
                <Label>Validade do PGR</Label>
                <Input type="date" value={formData.pgr_validity} onChange={e => setFormData(f => ({ ...f, pgr_validity: e.target.value }))} />
              </div>
              <div>
                <Label>Arquivo PGR</Label>
                <div className="flex gap-2 items-center">
                  <Input type="file" accept=".pdf,.doc,.docx" onChange={e => e.target.files[0] && handleFileUpload("pgr_file_url", e.target.files[0])} className="text-xs" />
                  {uploading.pgr_file_url && <span className="text-xs text-blue-500">Enviando...</span>}
                  {formData.pgr_file_url && <a href={formData.pgr_file_url} target="_blank" rel="noreferrer"><FileText className="w-4 h-4 text-green-600" /></a>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-green-50">
              <div className="col-span-2 font-semibold text-green-800 text-sm">PCMSO — Programa de Controle Médico de Saúde Ocupacional</div>
              <div>
                <Label>Validade do PCMSO</Label>
                <Input type="date" value={formData.pcmso_validity} onChange={e => setFormData(f => ({ ...f, pcmso_validity: e.target.value }))} />
              </div>
              <div>
                <Label>Arquivo PCMSO</Label>
                <div className="flex gap-2 items-center">
                  <Input type="file" accept=".pdf,.doc,.docx" onChange={e => e.target.files[0] && handleFileUpload("pcmso_file_url", e.target.files[0])} className="text-xs" />
                  {uploading.pcmso_file_url && <span className="text-xs text-green-500">Enviando...</span>}
                  {formData.pcmso_file_url && <a href={formData.pcmso_file_url} target="_blank" rel="noreferrer"><FileText className="w-4 h-4 text-green-600" /></a>}
                </div>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={formData.observations} onChange={e => setFormData(f => ({ ...f, observations: e.target.value }))} rows={3} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit">{editing ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}