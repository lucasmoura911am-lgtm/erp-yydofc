import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Eye, CheckCircle, Clock, Download } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MySignedTimeReports() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);

  const queryClient = useQueryClient();

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);

    const employees = await base44.entities.Employee.filter({
      user_email: userData.email,
    });
    if (employees.length > 0) {
      setEmployee(employees[0]);
    }
  };

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["mySignedTimeReports", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      return await base44.entities.SignedTimeReport.filter({
        employee_id: employee.id,
      }, "-created_date");
    },
    enabled: !!employee?.id,
  });

  const signMutation = useMutation({
    mutationFn: (reportId) =>
      base44.entities.SignedTimeReport.update(reportId, {
        status: "assinado",
        signed_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(["mySignedTimeReports"]);
      toast.success("Relatório assinado com sucesso");
    },
  });

  const pendingReports = reports.filter((r) => r.status === "pendente");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Meus Relatórios de Ponto
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visualize e assine seus relatórios de ponto mensais
          </p>
        </div>

        {pendingReports.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <Clock className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              Você tem {pendingReports.length} relatório(s) pendente(s) de assinatura
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatórios Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-gray-500">Carregando...</p>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  Nenhum relatório disponível ainda
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data de Assinatura</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {report.competence}
                      </TableCell>
                      <TableCell>
                        {report.status === "assinado" ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Assinado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {report.signed_at
                          ? new Date(report.signed_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={report.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={report.file_url}
                              download
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Baixar
                            </a>
                          </Button>
                          {report.status === "pendente" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => signMutation.mutate(report.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Assinar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}