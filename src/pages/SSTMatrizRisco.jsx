import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid, AlertTriangle } from "lucide-react";

// Mapeia os valores de string para numérico 1-5
const PROB_MAP = { baixa: 1, media: 3, alta: 5 };
const SEV_MAP = { leve: 1, moderada: 2, grave: 4, gravissima: 5 };

const PROB_LABELS = { 1: "Remota", 2: "Improvável", 3: "Possível", 4: "Provável", 5: "Frequente" };
const SEV_LABELS = { 1: "Insignificante", 2: "Leve", 3: "Moderado", 4: "Grave", 5: "Gravíssimo" };

// Calcula nível da célula p*s
function getLevel(p, s) {
  const score = p * s;
  if (score <= 2) return { label: "Trivial", color: "bg-green-200 text-green-900", border: "border-green-400" };
  if (score <= 5) return { label: "Tolerável", color: "bg-lime-200 text-lime-900", border: "border-lime-400" };
  if (score <= 10) return { label: "Moderado", color: "bg-yellow-200 text-yellow-900", border: "border-yellow-400" };
  if (score <= 16) return { label: "Substancial", color: "bg-orange-200 text-orange-900", border: "border-orange-400" };
  return { label: "Intolerável", color: "bg-red-200 text-red-900", border: "border-red-400" };
}

const RISK_TYPE_LABELS = { fisico: "Físico", quimico: "Químico", biologico: "Biológico", ergonomico: "Ergonômico", acidente: "Acidente" };
const RISK_TYPE_COLORS = { fisico: "bg-blue-100 text-blue-800", quimico: "bg-purple-100 text-purple-800", biologico: "bg-emerald-100 text-emerald-800", ergonomico: "bg-amber-100 text-amber-800", acidente: "bg-red-100 text-red-800" };

export default function SSTMatrizRisco() {
  const [user, setUser] = useState(null);
  const [filterContract, setFilterContract] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: risks = [] } = useQuery({ queryKey: ["risks"], queryFn: () => base44.entities.RiskInventory.list(), enabled: !!user });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list(), enabled: !!user });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), enabled: !!user });

  const getContractLabel = (cid) => { const c = contracts.find(x => x.id === cid); if (!c) return "—"; const cl = clients.find(x => x.id === c.client_id); return `${c.contract_number} — ${cl?.name || ""}`; };

  const filteredRisks = risks.filter(r => {
    if (filterContract && r.contract_id !== filterContract) return false;
    return true;
  });

  // Mapeia cada risco para coordenada P x S
  const getRisksForCell = (p, s) => filteredRisks.filter(r => {
    const rp = PROB_MAP[r.probability] || 3;
    const rs = SEV_MAP[r.severity] || 2;
    return rp === p && rs === s;
  });

  const levels = {
    trivial: filteredRisks.filter(r => { const p = PROB_MAP[r.probability] || 3; const s = SEV_MAP[r.severity] || 2; const sc = p * s; return sc <= 2; }).length,
    toleravel: filteredRisks.filter(r => { const p = PROB_MAP[r.probability] || 3; const s = SEV_MAP[r.severity] || 2; const sc = p * s; return sc > 2 && sc <= 5; }).length,
    moderado: filteredRisks.filter(r => { const p = PROB_MAP[r.probability] || 3; const s = SEV_MAP[r.severity] || 2; const sc = p * s; return sc > 5 && sc <= 10; }).length,
    substancial: filteredRisks.filter(r => { const p = PROB_MAP[r.probability] || 3; const s = SEV_MAP[r.severity] || 2; const sc = p * s; return sc > 10 && sc <= 16; }).length,
    intoleravel: filteredRisks.filter(r => { const p = PROB_MAP[r.probability] || 3; const s = SEV_MAP[r.severity] || 2; const sc = p * s; return sc > 16; }).length,
  };

  const cellRisks = selectedCell ? getRisksForCell(selectedCell.p, selectedCell.s) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <Grid className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Matriz de Risco 5×5</h1>
            <p className="text-gray-500 text-sm">Probabilidade × Severidade — NR-01 / GRO</p>
          </div>
        </div>
        <select className="border rounded-md px-3 py-2 text-sm min-w-[220px]" value={filterContract} onChange={e => { setFilterContract(e.target.value); setSelectedCell(null); }}>
          <option value="">Todos os contratos</option>
          {contracts.map(c => <option key={c.id} value={c.id}>{getContractLabel(c.id)}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { key: "trivial", label: "Trivial", color: "bg-green-100 border-green-300 text-green-800" },
          { key: "toleravel", label: "Tolerável", color: "bg-lime-100 border-lime-300 text-lime-800" },
          { key: "moderado", label: "Moderado", color: "bg-yellow-100 border-yellow-300 text-yellow-800" },
          { key: "substancial", label: "Substancial", color: "bg-orange-100 border-orange-300 text-orange-800" },
          { key: "intoleravel", label: "Intolerável", color: "bg-red-100 border-red-300 text-red-800" },
        ].map(l => (
          <Card key={l.key} className={`border ${l.color}`}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{levels[l.key]}</div>
              <div className="text-xs font-medium">{l.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Matriz Probabilidade × Severidade ({filteredRisks.length} riscos mapeados)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header de severidade */}
            <div className="flex mb-1 ml-28">
              {[1,2,3,4,5].map(s => (
                <div key={s} className="flex-1 text-center text-xs font-semibold text-gray-600 py-1 border-b">
                  <div>{s}</div>
                  <div className="text-gray-400 font-normal">{SEV_LABELS[s]}</div>
                </div>
              ))}
            </div>
            {/* Linhas de probabilidade (de 5 a 1, de cima para baixo) */}
            {[5,4,3,2,1].map(p => (
              <div key={p} className="flex mb-1 items-stretch">
                <div className="w-28 flex flex-col justify-center pr-2 text-right">
                  <div className="text-xs font-semibold text-gray-600">{p}</div>
                  <div className="text-xs text-gray-400">{PROB_LABELS[p]}</div>
                </div>
                {[1,2,3,4,5].map(s => {
                  const level = getLevel(p, s);
                  const cellRisksCount = getRisksForCell(p, s).length;
                  const isSelected = selectedCell?.p === p && selectedCell?.s === s;
                  return (
                    <div
                      key={s}
                      className={`flex-1 min-h-[70px] border-2 rounded m-0.5 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${level.color} ${level.border} ${isSelected ? "ring-2 ring-gray-800 scale-105" : ""}`}
                      onClick={() => setSelectedCell(isSelected ? null : { p, s })}
                    >
                      <div className="text-xs font-bold">{level.label}</div>
                      <div className="text-xs opacity-70">P{p}×S{s}={p*s}</div>
                      {cellRisksCount > 0 && (
                        <div className="mt-1 bg-white bg-opacity-60 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {cellRisksCount}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Labels dos eixos */}
            <div className="flex mt-2 ml-28">
              <div className="flex-1 text-center text-xs text-gray-500 font-medium">← Severidade →</div>
            </div>
          </div>
          <div className="text-xs text-gray-400 text-center mt-1 rotate-90 inline-block absolute" style={{left: '1.5rem', top: '50%'}}>← Probabilidade →</div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="font-medium text-gray-600">Legenda:</span>
            {[{label:"Trivial",c:"bg-green-200"},{label:"Tolerável",c:"bg-lime-200"},{label:"Moderado",c:"bg-yellow-200"},{label:"Substancial",c:"bg-orange-200"},{label:"Intolerável",c:"bg-red-200"}].map(l => (
              <span key={l.label} className={`flex items-center gap-1 px-2 py-1 rounded ${l.c}`}><span className="w-2 h-2 rounded-full bg-current opacity-60"></span>{l.label}</span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Clique em uma célula para ver os riscos nessa posição.</p>
        </CardContent>
      </Card>

      {/* Riscos da célula selecionada */}
      {selectedCell && (
        <Card className="border-2 border-orange-300">
          <CardHeader>
            <CardTitle className="text-sm">
              Riscos em P{selectedCell.p} × S{selectedCell.s} — {getLevel(selectedCell.p, selectedCell.s).label} ({cellRisks.length} riscos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cellRisks.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum risco nessa posição.</p>
            ) : (
              <div className="space-y-2">
                {cellRisks.map(r => (
                  <div key={r.id} className="flex items-start gap-3 bg-orange-50 rounded-lg p-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{r.risk_name}</div>
                      {r.risk_description && <div className="text-xs text-gray-500">{r.risk_description}</div>}
                      {r.control_measures && <div className="text-xs text-teal-700 mt-1">Controle: {r.control_measures}</div>}
                    </div>
                    <Badge className={RISK_TYPE_COLORS[r.risk_type]}>{RISK_TYPE_LABELS[r.risk_type]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}