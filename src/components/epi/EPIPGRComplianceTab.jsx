import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, HardHat, Link, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RISK_TYPE_LABEL = {
  fisico: "Físico",
  quimico: "Químico",
  biologico: "Biológico",
  ergonomico: "Ergonômico",
  acidente: "Acidente",
};

const RISK_LEVEL_COLOR = {
  baixo: "bg-green-100 text-green-700",
  medio: "bg-yellow-100 text-yellow-700",
  alto: "bg-orange-100 text-orange-700",
  critico: "bg-red-100 text-red-700",
};

export default function EPIPGRComplianceTab({ epis, logs, employees, companyId }) {
  const [selectedContract, setSelectedContract] = useState("all");
  const [filterRiskLevel, setFilterRiskLevel] = useState("all");

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts_pgr", companyId],
    queryFn: () => base44.entities.Contract.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_pgr", companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: riskInventory = [] } = useQuery({
    queryKey: ["risk_inventory", companyId],
    queryFn: () => base44.entities.RiskInventory.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: safetyPrograms = [] } = useQuery({
    queryKey: ["safety_programs", companyId],
    queryFn: () => base44.entities.ContractSafetyProgram.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const mandatoryEpis = epis.filter(e => e.mandatory_for_all || e.is_mandatory);
  const today = new Date().toISOString().split("T")[0];

  // Filter risks by contract and level
  const filteredRisks = useMemo(() => {
    return riskInventory.filter(r => {
      const byContract = selectedContract === "all" || r.contract_id === selectedContract;
      const byLevel = filterRiskLevel === "all" || r.risk_level === filterRiskLevel;
      return byContract && byLevel && r.active !== false;
    });
  }, [riskInventory, selectedContract, filterRiskLevel]);

  // Map each mandatory EPI → which risks reference it via control_measures
  // Also compute last 30 days compliance
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent30 = logs.filter(l => l.date >= thirtyDaysAgo.toISOString().split("T")[0]);

  const epiComplianceMap = useMemo(() => {
    return mandatoryEpis.map(epi => {
      const epiLogs = recent30.filter(l => l.epi_id === epi.id || l.epi_name?.toLowerCase() === epi.name?.toLowerCase());
      const usersWhoUsed = new Set(epiLogs.map(l => l.employee_email));
      const activeEmps = employees.filter(e => e.status !== "inactive");
      const complianceRate = activeEmps.length > 0 ? Math.round((usersWhoUsed.size / activeEmps.length) * 100) : 0;

      // Find related risks (risks whose control_measures mention this EPI name)
      const relatedRisks = filteredRisks.filter(r =>
        r.control_measures?.toLowerCase().includes(epi.name?.toLowerCase()) ||
        r.risk_name?.toLowerCase().includes("epi") ||
        r.risk_name?.toLowerCase().includes("proteção")
      );

      return {
        epi,
        usedBy: usersWhoUsed.size,
        totalActive: activeEmps.length,
        complianceRate,
        logsCount: epiLogs.length,
        relatedRisks,
      };
    });
  }, [mandatoryEpis, recent30, employees, filteredRisks]);

  // Contract overview
  const contractsWithProgram = contracts.map(c => {
    const program = safetyPrograms.find(p => p.contract_id === c.id);
    const client = clients.find(cl => cl.id === c.client_id);
    const contractRisks = riskInventory.filter(r => r.contract_id === c.id && r.active !== false);
    const criticalRisks = contractRisks.filter(r => r.risk_level === "critico" || r.risk_level === "alto");

    // EPI usage for employees linked to this contract's allocations
    const epiUsageRate = mandatoryEpis.length > 0
      ? Math.round((epiComplianceMap.filter(e => e.complianceRate > 0).length / mandatoryEpis.length) * 100)
      : 0;

    return { c, program, client, contractRisks, criticalRisks, epiUsageRate };
  });

  return (
    <div className="space-y-5">
      {/* OVERVIEW KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "EPIs Obrigatórios", value: mandatoryEpis.length, color: "from-violet-500 to-indigo-600" },
          { label: "Riscos no PGR", value: riskInventory.filter(r => r.active !== false).length, color: "from-orange-400 to-red-500" },
          { label: "Contratos com PGR/PCMSO", value: safetyPrograms.length, color: "from-blue-500 to-cyan-500" },
          { label: "Conformidade Média EPIs", value: epiComplianceMap.length > 0 ? Math.round(epiComplianceMap.reduce((a, b) => a + b.complianceRate, 0) / epiComplianceMap.length) + "%" : "N/A", color: "from-green-500 to-emerald-500" },
        ].map(k => (
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p>
            <p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedContract} onValueChange={setSelectedContract}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por contrato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contratos</SelectItem>
            {contracts.map(c => {
              const cl = clients.find(cl => cl.id === c.client_id);
              return <SelectItem key={c.id} value={c.id}>{c.contract_number} — {cl?.name || "Cliente"}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Nível de risco" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="alto">Alto</SelectItem>
            <SelectItem value="medio">Médio</SelectItem>
            <SelectItem value="baixo">Baixo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* EPI x COMPLIANCE - ÚLTIMOS 30 DIAS */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HardHat className="w-4 h-4 text-violet-500" />
            EPIs Obrigatórios — Conformidade (últimos 30 dias)
          </CardTitle>
          <p className="text-xs text-gray-500">Quanto dos funcionários ativos usaram cada EPI obrigatório</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {mandatoryEpis.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>Nenhum EPI obrigatório configurado</p>
              <p className="text-xs mt-1">Acesse a aba "⚙️ EPIs Obrigatórios" para configurar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {epiComplianceMap.map(({ epi, usedBy, totalActive, complianceRate, logsCount, relatedRisks }) => (
                <div key={epi.id} className={`rounded-2xl border p-4 ${complianceRate >= 80 ? "bg-green-50 dark:bg-green-900/10 border-green-200" : complianceRate >= 40 ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200" : "bg-red-50 dark:bg-red-900/10 border-red-200"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${complianceRate >= 80 ? "bg-green-200" : complianceRate >= 40 ? "bg-yellow-200" : "bg-red-200"}`}>
                      <HardHat className={`w-4 h-4 ${complianceRate >= 80 ? "text-green-700" : complianceRate >= 40 ? "text-yellow-700" : "text-red-700"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{epi.name}</span>
                        {epi.ca_number && <span className="text-xs text-gray-400">CA {epi.ca_number}</span>}
                        <Badge className={`text-xs ${complianceRate >= 80 ? "bg-green-100 text-green-700" : complianceRate >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                          {complianceRate}% ({usedBy}/{totalActive} funcionários)
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{logsCount} registros nos últimos 30 dias</p>

                      {/* Progress bar */}
                      <div className="mt-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${complianceRate >= 80 ? "bg-green-500" : complianceRate >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                          style={{ width: complianceRate + "%" }}
                        />
                      </div>

                      {/* Related risks */}
                      {relatedRisks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Link className="w-3 h-3" />Riscos relacionados:</span>
                          {relatedRisks.slice(0, 3).map(r => (
                            <Badge key={r.id} className={`text-xs ${RISK_LEVEL_COLOR[r.risk_level] || "bg-gray-100 text-gray-600"}`}>
                              {r.risk_name} ({RISK_TYPE_LABEL[r.risk_type] || r.risk_type})
                            </Badge>
                          ))}
                          {relatedRisks.length > 3 && <span className="text-xs text-gray-400">+{relatedRisks.length - 3}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PGR - RISCOS COM NECESSIDADE DE EPI */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Inventário de Riscos (PGR) — Medidas de Controle com EPI
          </CardTitle>
          <p className="text-xs text-gray-500">Riscos do inventário onde EPIs são parte das medidas de controle</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {filteredRisks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>Nenhum risco cadastrado no PGR</p>
              <p className="text-xs mt-1">Acesse Segurança do Trabalho → Inventário de Riscos para cadastrar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRisks
                .filter(r => r.control_measures)
                .sort((a, b) => {
                  const order = { critico: 0, alto: 1, medio: 2, baixo: 3 };
                  return (order[a.risk_level] || 2) - (order[b.risk_level] || 2);
                })
                .map(risk => {
                  const contract = contracts.find(c => c.id === risk.contract_id);
                  const client = clients.find(c => c.id === contract?.client_id);
                  // Check if any mandatory EPI covers this risk
                  const coveredEpis = mandatoryEpis.filter(epi =>
                    risk.control_measures?.toLowerCase().includes(epi.name?.toLowerCase())
                  );
                  const isCovered = coveredEpis.length > 0;

                  return (
                    <div key={risk.id} className={`p-3 rounded-xl border ${isCovered ? "bg-green-50 dark:bg-green-900/10 border-green-200" : "bg-orange-50 dark:bg-orange-900/10 border-orange-200"}`}>
                      <div className="flex items-start gap-2">
                        {isCovered
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          : <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{risk.risk_name}</span>
                            <Badge className={`text-xs ${RISK_LEVEL_COLOR[risk.risk_level] || ""}`}>{risk.risk_level}</Badge>
                            <Badge variant="outline" className="text-xs">{RISK_TYPE_LABEL[risk.risk_type] || risk.risk_type}</Badge>
                            {client && <span className="text-xs text-gray-400">{client.name}</span>}
                          </div>
                          {risk.control_measures && (
                            <p className="text-xs text-gray-500 mt-1">⚙️ {risk.control_measures}</p>
                          )}
                          {coveredEpis.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-1">
                              <span className="text-xs text-green-600 font-medium">EPIs obrigatórios configurados:</span>
                              {coveredEpis.map(e => (
                                <Badge key={e.id} className="bg-green-100 text-green-700 text-xs">{e.name}</Badge>
                              ))}
                            </div>
                          )}
                          {!isCovered && risk.control_measures?.toLowerCase().includes("epi") && (
                            <p className="text-xs text-orange-500 mt-1 font-medium">⚠️ Este risco requer EPI mas nenhum EPI obrigatório está configurado para cobrí-lo</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CONTRACTS OVERVIEW */}
      {contractsWithProgram.filter(c => c.program).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Contratos com PGR/PCMSO
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contractsWithProgram.filter(c => c.program).map(({ c, program, client, contractRisks, criticalRisks }) => (
                <div key={c.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{c.contract_number}</p>
                      {client && <p className="text-xs text-gray-400">{client.name}</p>}
                    </div>
                    <div className="flex gap-1">
                      {program.pgr_file_url && <Badge className="bg-blue-100 text-blue-700 text-xs">PGR</Badge>}
                      {program.pcmso_file_url && <Badge className="bg-purple-100 text-purple-700 text-xs">PCMSO</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>🔴 {criticalRisks.length} riscos críticos/altos</span>
                    <span>📋 {contractRisks.length} riscos totais</span>
                    {program.safety_manager && <span>👷 {program.safety_manager}</span>}
                  </div>
                  {program.pgr_validity && (
                    <p className={`text-xs mt-1 font-medium ${program.pgr_validity < today ? "text-red-500" : "text-green-600"}`}>
                      {program.pgr_validity < today ? "⚠️ PGR vencido em " : "✅ PGR válido até "}{program.pgr_validity}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}