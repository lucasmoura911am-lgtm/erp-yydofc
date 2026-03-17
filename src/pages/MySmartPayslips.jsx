import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, CheckCircle2, Clock, PenLine, Eye } from "lucide-react";
import PayslipSignModal from "@/components/payslips/PayslipSignModal";

const statusConfig = {
  pendente: { label: "Pendente Assinatura", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  assinado: { label: "Assinado", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  recusado: { label: "Recusado", color: "bg-red-100 text-red-800", icon: Clock },
};

export default function MySmartPayslips() {
  const [user, setUser] = React.useState(null);
  const [employee, setEmployee] = React.useState(null);
  const [signingPayslip, setSigningPayslip] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      base44.entities.Employee.filter({ user_email: u.email })
        .then(emps => { if (emps.length > 0) setEmployee(emps[0]); });
    });
  }, []);

  const { data: payslips = [] } = useQuery({
    queryKey: ["my_smart_payslips", employee?.id],
    queryFn: () => employee
      ? base44.entities.SmartPayslip.filter({ employee_id: employee.id }, "-data_upload")
      : [],
    enabled: !!employee,
  });

  const pendentes = payslips.filter(p => p.status_assinado === "pendente").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Meus Holerites</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visualize e assine seus contracheques</p>
      </div>

      {pendentes > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800 dark:text-yellow-300 text-sm font-medium">
            Você tem <strong>{pendentes}</strong> holerite(s) aguardando assinatura.
          </p>
        </div>
      )}

      {payslips.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Nenhum holerite disponível</h3>
            <p className="text-gray-500">Seus holerites aparecerão aqui quando forem disponibilizados pelo RH.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {payslips.map(p => {
            const cfg = statusConfig[p.status_assinado] || statusConfig.pendente;
            const Ico = cfg.icon;
            return (
              <Card key={p.id} className="hover:shadow-lg transition-all border-0 shadow-md">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{p.competencia}</p>
                        {p.valor_liquido > 0 && (
                          <p className="text-sm text-green-600 font-semibold">
                            R$ {p.valor_liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge className={cfg.color}>
                      <Ico className="w-3 h-3 mr-1" />{cfg.label}
                    </Badge>
                  </div>

                  {p.data_assinatura && (
                    <p className="text-xs text-gray-500">
                      Assinado em {new Date(p.data_assinatura).toLocaleString("pt-BR")}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {p.arquivo_pdf_individual && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.open(p.arquivo_pdf_individual, "_blank")}
                      >
                        <Eye className="w-4 h-4 mr-1" />Ver
                      </Button>
                    )}
                    {p.status_assinado === "pendente" && (
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                        onClick={() => setSigningPayslip(p)}
                      >
                        <PenLine className="w-4 h-4 mr-1" />Assinar
                      </Button>
                    )}
                    {p.status_assinado === "assinado" && (
                      <Button size="sm" variant="outline" className="flex-1 border-green-500 text-green-600">
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

      {signingPayslip && (
        <PayslipSignModal
          payslip={signingPayslip}
          onClose={() => setSigningPayslip(null)}
        />
      )}
    </div>
  );
}