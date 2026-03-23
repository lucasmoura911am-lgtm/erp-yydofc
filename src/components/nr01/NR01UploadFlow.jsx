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
import { format, isBefore, differenceInDays } from "date-fns";

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO CENTRAL: lê PDF via URL → base64 → envia para Claude API
// ─────────────────────────────────────────────────────────────────
async function extractDataFromDocuments({ pgrFileUrl, pcmsoFileUrl, contractId, companyId, responsible }) {
  // 1. Monta os blocos de documento para a Claude API
  const contentBlocks = [];

  const fetchAsBase64 = async (url, label) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error(`Erro ao buscar ${label}:`, e);
      return null;
    }
  };

  if (pgrFileUrl) {
    const b64 = await fetchAsBase64(pgrFileUrl, "PGR");
    if (b64) {
      contentBlocks.push({
        type: "text",
        text: "A seguir está o documento PGR (Programa de Gerenciamento de Riscos):"
      });
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: b64 }
      });
    }
  }

  if (pcmsoFileUrl) {
    const b64 = await fetchAsBase64(pcmsoFileUrl, "PCMSO");
    if (b64) {
      contentBlocks.push({
        type: "text",
        text: "A seguir está o documento PCMSO (Programa de Controle Médico de Saúde Ocupacional):"
      });
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: b64 }
      });
    }
  }

  if (contentBlocks.length === 0) {
    throw new Error("Nenhum documento pôde ser lido.");
  }

  // 2. Prompt instruindo extração em JSON puro
  contentBlocks.push({
    type: "text",
    text: `Leia cuidadosamente os documentos PGR e/ou PCMSO acima e extraia TODAS as informações relevantes.

Retorne APENAS um objeto JSON válido, sem texto antes ou depois, sem blocos de código markdown, sem explicações. Estrutura:

{
  "empresa": {
    "razao_social": "",
    "cnpj": "",
    "empresa_contratante": "",
    "grau_risco": "",
    "cnae": "",
    "endereco": ""
  },
  "pgr": {
    "responsavel_tecnico": "",
    "crea": "",
    "inicio_validade": "",
    "revisar_ate": "",
    "iqct_geral": ""
  },
  "pcmso": {
    "medico_responsavel": "",
    "crm": "",
    "rqe": "",
    "inicio_validade": "",
    "revisar_ate": ""
  },
  "ambientes": [
    { "nome": "", "descricao": "" }
  ],
  "cargos": [
    {
      "nome": "",
      "cbo": "",
      "atividades": "",
      "iqct": "",
      "num_empregados": ""
    }
  ],
  "riscos": [
    {
      "cargo": "",
      "categoria": "mecanico|ergonomico|fisico|quimico|biologico",
      "agente": "",
      "exposicao": "",
      "probabilidade": "",
      "probabilidade_nivel": 0,
      "severidade": "",
      "severidade_nivel": 0,
      "nivel_risco": "trivial|toleravel|moderado|substancial|intoleravel",
      "possíveis_danos": "",
      "controle_necessario": true,
      "epis_obrigatorios": ""
    }
  ],
  "plano_acao": [
    {
      "descricao": "",
      "mes_previsto": "",
      "ano_previsto": "",
      "periodicidade": "unica|mensal|trimestral|semestral|anual",
      "tipo": "treinamento|orientacao|elaboracao|controle|monitoramento|outro",
      "nivel_prioridade": "alta|media|baixa"
    }
  ],
  "exames_por_cargo": [
    {
      "cargo": "",
      "exames": [
        {
          "nome": "",
          "codigo_esocial": "",
          "admissional": true,
          "periodico": true,
          "demissional": false,
          "retorno_trabalho": false,
          "mudanca_risco": true,
          "periodicidade_meses": 12,
          "observacoes": ""
        }
      ]
    }
  ],
  "treinamentos_exigidos": [
    {
      "nr_referencia": "",
      "descricao": "",
      "periodicidade": "",
      "cargo_aplicavel": "todos|especifico",
      "cargos_especificos": ""
    }
  ],
  "vacinacao": [
    {
      "vacina": "",
      "periodicidade": "",
      "grupo_risco": ""
    }
  ]
}

IMPORTANTE:
- Extraia TODAS as ações do plano de ação, sem exceção
- Extraia TODOS os riscos de TODOS os cargos
- Extraia TODOS os exames de TODOS os cargos
- Para riscos SUBSTANCIAL e INTOLERAVEL, marque controle_necessario como true
- Preencha os campos com as informações exatas do documento
- Se um campo não existir no documento, use string vazia ou false`
  });

  // 3. Chama Claude API
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: contentBlocks }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro na API Claude: ${err}`);
  }

  const data = await response.json();
  const rawText = data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");

  // 4. Parse do JSON retornado
  const clean = rawText.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error("Resposta bruta da API:", rawText);
    throw new Error("Claude não retornou JSON válido. Tente novamente.");
  }
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO: salva os dados extraídos nas entidades do Base44
// ─────────────────────────────────────────────────────────────────
async function saveExtractedData(extracted, { contractId, companyId, programId }) {
  const results = {
    risks_created: 0,
    actions_created: 0,
    health_plans_created: 0,
    exams_created: 0,
    trainings_created: 0,
    errors: []
  };

  // Salva riscos
  if (extracted.riscos?.length > 0) {
    for (const risco of extracted.riscos) {
      try {
        await base44.entities.RiskInventory.create({
          contract_id: contractId,
          company_id: companyId,
          cargo: risco.cargo,
          categoria: risco.categoria,
          agente: risco.agente,
          exposicao: risco.exposicao,
          probabilidade: risco.probabilidade,
          probabilidade_nivel: risco.probabilidade_nivel,
          severidade: risco.severidade,
          severidade_nivel: risco.severidade_nivel,
          risk_level: mapRiskLevel(risco.nivel_risco),
          nivel_risco: risco.nivel_risco,
          possiveis_danos: risco.possíveis_danos || risco.possiveis_danos,
          controle_necessario: risco.controle_necessario,
          epis_obrigatorios: risco.epis_obrigatorios,
          status: risco.controle_necessario ? "pendente" : "controlado",
          source: "pgr_upload"
        });
        results.risks_created++;
      } catch (e) {
        results.errors.push(`Risco "${risco.agente}": ${e.message}`);
      }
    }
  }

  // Salva ações do plano
  if (extracted.plano_acao?.length > 0) {
    for (const acao of extracted.plano_acao) {
      try {
        // Calcula deadline aproximado
        let deadline = null;
        if (acao.mes_previsto && acao.ano_previsto) {
          const meses = {
            "janeiro": "01", "fevereiro": "02", "março": "03", "abril": "04",
            "maio": "05", "junho": "06", "julho": "07", "agosto": "08",
            "setembro": "09", "outubro": "10", "novembro": "11", "dezembro": "12",
            "jan": "01", "fev": "02", "mar": "03", "abr": "04",
            "mai": "05", "jun": "06", "jul": "07", "ago": "08",
            "set": "09", "out": "10", "nov": "11", "dez": "12"
          };
          const mes = meses[acao.mes_previsto.toLowerCase()] || "01";
          deadline = `${acao.ano_previsto}-${mes}-01`;
        }

        await base44.entities.RiskActionPlan.create({
          contract_id: contractId,
          company_id: companyId,
          description: acao.descricao,
          deadline,
          mes_previsto: acao.mes_previsto,
          ano_previsto: acao.ano_previsto,
          periodicidade: acao.periodicidade,
          tipo: acao.tipo,
          priority: acao.nivel_prioridade,
          status: "pendente",
          source: "pgr_upload"
        });
        results.actions_created++;
      } catch (e) {
        results.errors.push(`Ação "${acao.descricao?.slice(0, 40)}": ${e.message}`);
      }
    }
  }

  // Salva planos de saúde / exames por cargo (PCMSO)
  if (extracted.exames_por_cargo?.length > 0) {
    for (const plano of extracted.exames_por_cargo) {
      try {
        const hp = await base44.entities.HealthActivityPlan.create({
          contract_id: contractId,
          company_id: companyId,
          cargo: plano.cargo,
          exames: plano.exames,
          total_exames: plano.exames?.length || 0,
          source: "pcmso_upload"
        });
        results.health_plans_created++;

        // Cria registros individuais de exame (SSTExame) se a entidade existir
        if (plano.exames?.length > 0) {
          for (const exame of plano.exames) {
            try {
              await base44.entities.SSTExame.create({
                contract_id: contractId,
                company_id: companyId,
                cargo: plano.cargo,
                nome_exame: exame.nome,
                codigo_esocial: exame.codigo_esocial,
                admissional: exame.admissional,
                periodico: exame.periodico,
                demissional: exame.demissional,
                retorno_trabalho: exame.retorno_trabalho,
                mudanca_risco: exame.mudanca_risco,
                periodicidade_meses: exame.periodicidade_meses || 12,
                observacoes: exame.observacoes,
                status: "pendente",
                source: "pcmso_upload"
              });
              results.exams_created++;
            } catch (e) {
              // SSTExame pode não existir, ignorar silenciosamente
            }
          }
        }
      } catch (e) {
        results.errors.push(`Plano cargo "${plano.cargo}": ${e.message}`);
      }
    }
  }

  // Salva treinamentos exigidos
  if (extracted.treinamentos_exigidos?.length > 0) {
    for (const trein of extracted.treinamentos_exigidos) {
      try {
        await base44.entities.SSTTreinamento.create({
          contract_id: contractId,
          company_id: companyId,
          nr_referencia: trein.nr_referencia,
          descricao: trein.descricao,
          periodicidade: trein.periodicidade,
          cargo_aplicavel: trein.cargo_aplicavel,
          cargos_especificos: trein.cargos_especificos,
          status: "pendente",
          source: "pgr_pcmso_upload"
        });
        results.trainings_created++;
      } catch (e) {
        // Entidade pode não existir
      }
    }
  }

  return results;
}

// helper: mapeia nível de risco para campo risk_level
function mapRiskLevel(nivel) {
  const map = {
    "trivial": "trivial",
    "toleravel": "baixo",
    "moderado": "medio",
    "substancial": "alto",
    "intoleravel": "critico"
  };
  return map[nivel?.toLowerCase()] || "medio";
}

// ─────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────
export default function NR01UploadFlow({ user, contracts, clients, programs, onProgramSaved }) {
  const qc = useQueryClient();
  const pgrRef = useRef();
  const pcmsoRef = useRef();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    contract_id: "", safety_manager: "", safety_manager_crea: "",
    pgr_validity: "", pcmso_validity: "",
    pgr_file_url: "", pcmso_file_url: "", observations: ""
  });
  const [uploading, setUploading] = useState({});
  const [analyzing, setAnalyzing] = useState(null);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [step, setStep] = useState("form"); // form | processing | result
  const [progressMsg, setProgressMsg] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const getContractLabel = (cid) => {
    const c = contracts.find(x => x.id === cid);
    if (!c) return "—";
    const cl = clients.find(x => x.id === c.client_id);
    return `${c.contract_number} — ${cl?.name || ""}`;
  };

  const daysLeft = (d) => d ? differenceInDays(new Date(d), new Date()) : null;
  const isExpired = (d) => d && isBefore(new Date(d), new Date());

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
      toast.success("Arquivo enviado!");
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
        saved = await base44.entities.ContractSafetyProgram.create({
          ...form, company_id: user.company_id
        });
      }
      qc.invalidateQueries(["safety_programs"]);

      const hasNewPgr = form.pgr_file_url && form.pgr_file_url !== editing?.pgr_file_url;
      const hasNewPcmso = form.pcmso_file_url && form.pcmso_file_url !== editing?.pcmso_file_url;

      if (hasNewPgr || hasNewPcmso) {
        await runAnalysis({
          contract_id: form.contract_id,
          company_id: user.company_id,
          pgr_file_url: hasNewPgr ? form.pgr_file_url : null,
          pcmso_file_url: hasNewPcmso ? form.pcmso_file_url : null,
          responsible: form.safety_manager || "",
          program_id: saved?.id || editing?.id
        });
      } else {
        toast.success("Programa salvo!");
        resetForm();
      }
    } catch (e) {
      toast.error("Erro ao salvar: " + e.message);
    }
  };

  const runAnalysis = async ({ contract_id, company_id, pgr_file_url, pcmso_file_url, responsible, program_id }) => {
    setAnalyzing(program_id);
    setStep("processing");
    setProgressMsg("Baixando os PDFs...");

    try {
      // Passo 1: Extrai dados com Claude API
      setProgressMsg("Lendo documentos com IA (pode levar 1-2 minutos)...");
      const extracted = await extractDataFromDocuments({
        pgrFileUrl: pgr_file_url,
        pcmsoFileUrl: pcmso_file_url,
        contractId: contract_id,
        companyId: company_id,
        responsible
      });

      setExtractedData(extracted);
      setProgressMsg("Salvando riscos, ações e exames no sistema...");

      // Passo 2: Salva no banco
      const saveResults = await saveExtractedData(extracted, {
        contractId: contract_id,
        companyId: company_id,
        programId: program_id
      });

      setAnalyzeResult({
        message: `Extração concluída para ${extracted.empresa?.razao_social || "a empresa"}`,
        risks_created: saveResults.risks_created,
        actions_created: saveResults.actions_created,
        health_plans_created: saveResults.health_plans_created,
        exams_created: saveResults.exams_created,
        trainings_created: saveResults.trainings_created,
        errors: saveResults.errors,
        empresa: extracted.empresa,
        total_cargos: extracted.cargos?.length || 0,
        total_riscos_raw: extracted.riscos?.length || 0
      });

      // Invalida todos os caches
      qc.invalidateQueries(["risks"]);
      qc.invalidateQueries(["actions"]);
      qc.invalidateQueries(["health_plans"]);
      qc.invalidateQueries(["sst_exames"]);
      qc.invalidateQueries(["sst_treinamentos"]);

      setStep("result");
      toast.success("Documentos processados com sucesso!");

    } catch (e) {
      toast.error("Erro na análise: " + e.message);
      console.error(e);
      setStep("form");
    } finally {
      setAnalyzing(null);
      setProgressMsg("");
    }
  };

  const resetForm = () => {
    setForm({
      contract_id: "", safety_manager: "", safety_manager_crea: "",
      pgr_validity: "", pcmso_validity: "",
      pgr_file_url: "", pcmso_file_url: "", observations: ""
    });
    setEditing(null);
    setDialogOpen(false);
    setStep("form");
    setAnalyzeResult(null);
    setExtractedData(null);
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({
      contract_id: p.contract_id, safety_manager: p.safety_manager || "",
      safety_manager_crea: p.safety_manager_crea || "",
      pgr_validity: p.pgr_validity || "", pcmso_validity: p.pcmso_validity || "",
      pgr_file_url: p.pgr_file_url || "", pcmso_file_url: p.pcmso_file_url || "",
      observations: p.observations || ""
    });
    setStep("form");
    setDialogOpen(true);
  };

  const handleReanalyze = (p) => {
    if (!p.pgr_file_url && !p.pcmso_file_url) { toast.error("Nenhum arquivo vinculado"); return; }
    if (!confirm("Reler os documentos e criar novos registros? Registros existentes não serão apagados.")) return;
    setDialogOpen(true);
    runAnalysis({
      contract_id: p.contract_id,
      company_id: p.company_id || user?.company_id,
      pgr_file_url: p.pgr_file_url || null,
      pcmso_file_url: p.pcmso_file_url || null,
      responsible: p.safety_manager || "",
      program_id: p.id
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Programas PGR / PCMSO</h2>
          <p className="text-sm text-gray-500">
            Faça upload dos documentos — a IA extrai automaticamente riscos, ações e exames.
          </p>
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
              <p className="text-sm mt-1">Clique em "Novo Programa" para começar</p>
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
                <p className="text-sm text-blue-600 mt-1">{progressMsg}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Isso pode levar 1-2 minutos. O Claude lê o PDF completo e extrai
                  todos os riscos, ações, exames e treinamentos.
                </p>
              </div>
              {/* Barra animada de progresso */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 mx-auto max-w-xs">
                <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: "70%" }} />
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

              {/* Dados da empresa extraídos */}
              {analyzeResult.empresa && (
                <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium text-gray-700">Empresa identificada:</p>
                  <p className="text-gray-600">{analyzeResult.empresa.razao_social} — CNPJ: {analyzeResult.empresa.cnpj}</p>
                  {analyzeResult.empresa.empresa_contratante && (
                    <p className="text-gray-500 text-xs">Contratante: {analyzeResult.empresa.empresa_contratante}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Riscos mapeados", val: analyzeResult.risks_created, color: "orange" },
                  { label: "Ações do plano", val: analyzeResult.actions_created, color: "blue" },
                  { label: "Planos PCMSO", val: analyzeResult.health_plans_created, color: "green" },
                  { label: "Exames criados", val: analyzeResult.exams_created, color: "teal" },
                  { label: "Treinamentos", val: analyzeResult.trainings_created, color: "purple" },
                  { label: "Cargos", val: analyzeResult.total_cargos, color: "gray" },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 border rounded-lg p-3 text-center">
                    <div className={`text-2xl font-bold text-${item.color}-600`}>{item.val ?? 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              {analyzeResult.errors?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-800 mb-1">
                    Avisos ({analyzeResult.errors.length}):
                  </p>
                  {analyzeResult.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-yellow-700">{e}</p>
                  ))}
                  {analyzeResult.errors.length > 5 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      + {analyzeResult.errors.length - 5} outros avisos
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>Fechar</Button>
                <Button onClick={() => { resetForm(); onProgramSaved && onProgramSaved(form.contract_id); }}>
                  <ChevronRight className="w-4 h-4 mr-1" /> Ver Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* Step: form */}
          {step === "form" && (
            <div className="space-y-5">
              {/* Seletor de contrato */}
              <div>
                <Label>Contrato *</Label>
                <select
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                  value={form.contract_id}
                  onChange={e => set("contract_id", e.target.value)}
                >
                  <option value="">Selecione o contrato...</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Responsável Técnico</Label>
                  <Input
                    className="mt-1"
                    value={form.safety_manager}
                    onChange={e => set("safety_manager", e.target.value)}
                    placeholder="Eng. / Técnico SST"
                  />
                </div>
                <div>
                  <Label>CREA / CRM</Label>
                  <Input
                    className="mt-1"
                    value={form.safety_manager_crea}
                    onChange={e => set("safety_manager_crea", e.target.value)}
                  />
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
                    <Input
                      type="date" className="mt-1"
                      value={form.pgr_validity}
                      onChange={e => set("pgr_validity", e.target.value)}
                    />
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
                          <CheckCircle2 className="w-4 h-4" /> PDF enviado ✓
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          <Upload className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                          Clique ou arraste o PDF do PGR
                        </div>
                      )}
                    </div>
                    <input
                      ref={pgrRef} type="file" accept=".pdf" className="hidden"
                      onChange={e => e.target.files[0] && handleFileUpload("pgr_file_url", e.target.files[0])}
                    />
                  </div>
                </div>
              </div>

              {/* PCMSO */}
              <div className="border rounded-xl p-4 bg-green-50/50 space-y-3">
                <p className="font-semibold text-green-800 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> PCMSO — Controle Médico de Saúde Ocupacional
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Validade</Label>
                    <Input
                      type="date" className="mt-1"
                      value={form.pcmso_validity}
                      onChange={e => set("pcmso_validity", e.target.value)}
                    />
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
                          <CheckCircle2 className="w-4 h-4" /> PDF enviado ✓
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          <Upload className="w-5 h-5 mx-auto mb-1 text-green-400" />
                          Clique ou arraste o PDF do PCMSO
                        </div>
                      )}
                    </div>
                    <input
                      ref={pcmsoRef} type="file" accept=".pdf" className="hidden"
                      onChange={e => e.target.files[0] && handleFileUpload("pcmso_file_url", e.target.files[0])}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                💡 <strong>Como funciona:</strong> após salvar, o Claude lê os PDFs diretamente e extrai
                automaticamente todos os riscos, o plano de ação completo, os exames médicos por cargo
                e os treinamentos exigidos pelas NRs.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button onClick={handleSave} disabled={!form.contract_id}>
                  {(form.pgr_file_url || form.pcmso_file_url)
                    ? "Salvar e Processar com IA"
                    : "Salvar"
                  }
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
