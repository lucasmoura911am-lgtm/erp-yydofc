import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText, CheckCircle2, Clock, AlertCircle, Upload,
  Search, Eye, Download, Shield, BarChart3, Users
} from "lucide-react";
import { Link } from "react-router-dom";

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
  assinado: { label: "Assinado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  recusado: { label: "Recusado", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: AlertCircle },
};

export default function SmartPayslipsDashboard() {
  const [user, setUser] = React.useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: payslips = [] } = useQuery({
    queryKey: ["smart_payslips", user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.SmartPayslip.filter({ company_id: user.company_id }, "-data_upload") : [],
    enabled: !!user?.company_id,
  });

  const total = payslips.length;
  const assinados = payslips.filter(p => p.status_assinado === "assinado").length;
  const pendentes = payslips.filter(p => p.status_assinado === "pendente").length;
  const pctAssinados = total > 0 ? Math.round((assinados / total) * 100) : 0;

  const filtered = payslips.filter(p => {
    const matchSearch = !search ||
      (p.employee_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.competencia || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.employee_code || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || p.status_assinado === filterStatus;
    return matchSearch && matchStatus;
  });

  // Group by competencia
  const byCompetencia = {};
  payslips.forEach(p => {
    if (!byCompetencia[p.competencia]) byCompetencia[p.competencia] = { total: 0, assinados: 0 };
    byCompetencia[p.competencia].total++;
    if (p.status_assinado === "assinado") byCompetencia[p.competencia].assinados++;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Holerites Inteligentes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Dashboard de controle e assinatura digital</p>
        </div>
        <Link to="/SmartPayslipsUpload">
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
            <Upload className="w-4 h-4 mr-2" />
            Upload em Lote
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Enviados</p>
                <p className="text-3xl font-bold mt-1">{total}</p>
              </div>
              <div className="bg-white/20 rounded-xl p-2"><FileText className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-100 text-sm font-medium">Assinados</p>
                <p className="text-3xl font-bold mt-1">{assinados}</p>
              </div>
              <div className="bg-white/20 rounded-xl p-2"><CheckCircle2 className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-yellow-100 text-sm font-medium">Pendentes</p>
                <p className="text-3xl font-bold mt-1">{pendentes}</p>
              </div>
              <div className="bg-white/20 rounded-xl p-2"><Clock className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500 to-purple-700 text-white">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-purple-100 text-sm font-medium">% Assinados</p>
                <p className="text-3xl font-bold mt-1">{pctAssinados}%</p>
              </div>
              <div className="bg-white/20 rounded-xl p-2"><BarChart3 className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress by competencia */}
      {Object.keys(byCompetencia).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-purple-600" />Progresso por Competência</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byCompetencia).sort((a, b) => b[0].localeCompare(a[0])).map(([comp, data]) => {
                const pct = Math.round((data.assinados / data.total) * 100);
                return (
                  <div key={comp}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{comp}</span>
                      <span className="text-gray-500">{data.assinados}/{data.total} assinados ({pct}%)</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-600" />Lista de Holerites</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {["todos", "pendente", "assinado", "recusado"].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={filterStatus === s ? "default" : "outline"}
                  onClick={() => setFilterStatus(s)}
                  className={filterStatus === s ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white" : ""}
                >
                  {s === "todos" ? "Todos" : statusConfig[s]?.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar funcionário, competência, matrícula..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum holerite encontrado</p>
              </div>
            ) : filtered.map(p => {
              const cfg = statusConfig[p.status_assinado] || statusConfig.pendente;
              const Ico = cfg.icon;
              return (
                <div key={p.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{p.employee_name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs text-gray-500">Comp.: {p.competencia}</span>
                        {p.employee_code && <span className="text-xs text-gray-400">Mat.: {p.employee_code}</span>}
                        {p.valor_liquido > 0 && (
                          <span className="text-xs text-green-600 font-medium">
                            R$ {p.valor_liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cfg.color}>
                      <Ico className="w-3 h-3 mr-1" />{cfg.label}
                    </Badge>
                    {p.data_assinatura && (
                      <span className="text-xs text-gray-400">
                        {new Date(p.data_assinatura).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {p.arquivo_pdf_individual && (
                      <Button size="sm" variant="outline" onClick={() => window.open(p.arquivo_pdf_individual, "_blank")}>
                        <Eye className="w-3.5 h-3.5 mr-1" />Ver
                      </Button>
                    )}
                    {p.status_assinado === "assinado" && p.assinatura_digital && (
                      <Button size="sm" variant="outline" className="border-green-500 text-green-600" onClick={() => window.open(p.assinatura_digital, "_blank")}>
                        <Shield className="w-3.5 h-3.5 mr-1" />Ass.
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}