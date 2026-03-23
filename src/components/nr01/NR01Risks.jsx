import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const TYPE_COLORS = { fisico: "bg-blue-100 text-blue-800", quimico: "bg-purple-100 text-purple-800", biologico: "bg-emerald-100 text-emerald-800", ergonomico: "bg-amber-100 text-amber-800", acidente: "bg-red-100 text-red-800" };
const TYPE_LABELS = { fisico: "Físico", quimico: "Químico", biologico: "Biológico", ergonomico: "Ergonômico", acidente: "Acidente" };
const LEVEL_COLORS = { baixo: "bg-green-100 text-green-800", medio: "bg-yellow-100 text-yellow-800", alto: "bg-orange-100 text-orange-800", critico: "bg-red-100 text-red-800" };
const LEVEL_LABELS = { baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico" };

export default function NR01Risks({ user, risks, contracts, clients, selectedContract }) {
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RiskInventory.delete(id),
    onSuccess: () => { qc.invalidateQueries(["risks"]); toast.success("Risco removido!"); }
  });

  const filtered = risks.filter(r => {
    if (filterType && r.risk_type !== filterType) return false;
    if (filterLevel && r.risk_level !== filterLevel) return false;
    return true;
  });

  const criticalCount = risks.filter(r => r.risk_level === "critico" || r.risk_level === "alto").length;

  const stats = {
    total: risks.length,
    critico: risks.filter(r => r.risk_level === "critico").length,
    alto: risks.filter(r => r.risk_level === "alto").length,
    medio: risks.filter(r => r.risk_level === "medio").length,
    baixo: risks.filter(r => r.risk_level === "baixo").length,
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", val: stats.total, color: "gray" },
          { label: "Crítico", val: stats.critico, color: "red" },
          { label: "Alto", val: stats.alto, color: "orange" },
          { label: "Médio", val: stats.medio, color: "yellow" },
          { label: "Baixo", val: stats.baixo, color: "green" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold text-${s.color}-600`}>{s.val}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {criticalCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">{criticalCount} risco(s) de nível ALTO/CRÍTICO identificados</p>
            <p className="text-xs text-red-600 mt-0.5">Exigem AÇÃO IMEDIATA conforme NR-01. Registre evidências de controle implementado.</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select className="border rounded-md px-3 py-1.5 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="border rounded-md px-3 py-1.5 text-sm" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">Todos os níveis</option>
          {Object.entries(LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-gray-500 flex items-center">{filtered.length} risco(s)</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risco</TableHead>
                <TableHead>Setor / Cargo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Controles</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-10">
                  Nenhum risco mapeado. Faça upload do PGR para importar automaticamente.
                </TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.id} className={(r.risk_level === "critico" || r.risk_level === "alto") ? "bg-red-50/50" : ""}>
                  <TableCell>
                    <div className="font-medium text-sm">{r.risk_name}</div>
                    {r.risk_description && <div className="text-xs text-gray-400 max-w-[200px] truncate">{r.risk_description}</div>}
                    {(r.risk_level === "critico" || r.risk_level === "alto") && (
                      <Badge className="bg-red-600 text-white text-xs mt-1">AÇÃO OBRIGATÓRIA</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{r.department_id ? "—" : "—"}</TableCell>
                  <TableCell><Badge className={TYPE_COLORS[r.risk_type] || "bg-gray-100"}>{TYPE_LABELS[r.risk_type] || r.risk_type}</Badge></TableCell>
                  <TableCell><Badge className={LEVEL_COLORS[r.risk_level] || "bg-gray-100"}>{LEVEL_LABELS[r.risk_level] || r.risk_level}</Badge></TableCell>
                  <TableCell className="capitalize text-sm">{r.probability || "—"}</TableCell>
                  <TableCell className="capitalize text-sm">{r.severity || "—"}</TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-[150px]">
                    {r.control_measures ? (
                      <span title={r.control_measures}>{r.control_measures.slice(0, 60)}{r.control_measures.length > 60 ? "..." : ""}</span>
                    ) : <span className="text-red-400">Sem controle registrado</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir risco?")) deleteMutation.mutate(r.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}