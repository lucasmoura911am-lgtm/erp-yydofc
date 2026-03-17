import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye, CheckCircle2, Clock, PenLine, Download } from "lucide-react";
import TimeReportSignModal from "@/components/timereport/TimeReportSignModal";

const statusConfig = {
  pendente: { label: "Pendente Assinatura", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  assinado: { label: "Assinado", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
};

export default function MySignedTimeReports() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [signingReport, setSigningReport] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      base44.entities.Employee.filter({ user_email: u.email })
        .then(emps => { if (emps.length > 0) setEmployee(emps[0]); });
    });
  }, []);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["mySignedTimeReports", employee?.id],
    queryFn: () => employee
      ? base44.entities.SignedTimeReport.filter({ employee_id: employee.id }, "-created_date")
      : [],
    enabled: !!employee,
  });

  const pendentes = reports.filter(r => r.status === "pendente").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Minha Folha de Ponto</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visualize e assine suas folhas de ponto mensais</p>
      </div>

      {pendentes > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800 dark:text-yellow-300 text-sm font-medium">
            Você tem <strong>{pendentes}</strong> folha(s) de ponto aguardando assinatura.
          </p>
        </div>
      )}

      {isLoading ? (
        <p className="text-center py-12 text-gray-500">Carregando...</p>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Nenhuma folha disponível</h3>
            <p className="text-gray-500">Suas folhas de ponto aparecerão aqui ao final de cada mês.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(r => {
            const cfg = statusConfig[r.status] || statusConfig.pendente;
            const Ico = cfg.icon;
            return (
              <Card key={r.id} className="hover:shadow-lg transition-all border-0 shadow-md">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{r.competence}</p>
                        <p className="text-xs text-gray-500">Folha de Ponto</p>
                      </div>
                    </div>
                    <Badge className={cfg.color}>
                      <Ico className="w-3 h-3 mr-1" />{cfg.label}
                    </Badge>
                  </div>

                  {r.data_assinatura && (
                    <p className="text-xs text-gray-500">
                      Assinado em {new Date(r.data_assinatura).toLocaleString("pt-BR")}
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {r.file_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.open(r.file_url, "_blank")}
                      >
                        <Eye className="w-4 h-4 mr-1" />Ver
                      </Button>
                    )}
                    {r.status === "pendente" && (
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                        onClick={() => setSigningReport(r)}
                      >
                        <PenLine className="w-4 h-4 mr-1" />Assinar
                      </Button>
                    )}
                    {r.status === "assinado" && r.arquivo_pdf_assinado && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-green-500 text-green-600"
                        onClick={() => window.open(r.arquivo_pdf_assinado, "_blank")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />PDF Assinado
                      </Button>
                    )}
                    {r.status === "assinado" && !r.arquivo_pdf_assinado && (
                      <Button size="sm" variant="outline" className="flex-1 border-green-500 text-green-600" disabled>
                        <CheckCircle2 className="w-4 h-4 mr-1" />Assinado
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {signingReport && (
        <TimeReportSignModal
          report={signingReport}
          employeeName={employee?.full_name || user?.full_name || ""}
          onClose={() => setSigningReport(null)}
        />
      )}
    </div>
  );
}