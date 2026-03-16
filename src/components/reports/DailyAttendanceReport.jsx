import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DailyAttendanceReport({ companyId }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => base44.entities.Employee.filter({ company_id: companyId, status: "active" }),
    enabled: !!companyId,
  });

  const { data: timeRecords = [], isLoading } = useQuery({
    queryKey: ["timeRecords-daily", companyId, selectedDate],
    queryFn: () => base44.entities.TimeRecord.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  // Filtrar registros do dia selecionado
  const dayRecords = timeRecords.filter((r) => {
    if (!r.timestamp) return false;
    return r.timestamp.startsWith(selectedDate);
  });

  // Montar mapa de registros por funcionário
  const employeeMap = employees.map((emp) => {
    const empRecords = dayRecords
      .filter((r) => r.employee_id === emp.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const entrada = empRecords.find((r) => r.type === "entrada");
    const pausa = empRecords.find((r) => r.type === "pausa");
    const retorno = empRecords.find((r) => r.type === "retorno");
    const saida = empRecords.find((r) => r.type === "saida");

    const bateuPonto = empRecords.length > 0;

    return {
      ...emp,
      empRecords,
      entrada,
      pausa,
      retorno,
      saida,
      bateuPonto,
    };
  });

  const bateram = employeeMap.filter((e) => e.bateuPonto);
  const naoBateram = employeeMap.filter((e) => !e.bateuPonto);

  const getStatusBadge = (record) => {
    if (!record) return null;
    const statusMap = {
      pontual: <Badge className="bg-green-500 text-white text-xs">Pontual</Badge>,
      atrasado: <Badge className="bg-orange-500 text-white text-xs">Atraso {record.delay_minutes}min</Badge>,
      adiantado: <Badge className="bg-blue-500 text-white text-xs">Adiantado</Badge>,
      hora_extra: <Badge className="bg-purple-500 text-white text-xs">Hora Extra</Badge>,
    };
    return statusMap[record.status] || null;
  };

  const formatTime = (record) => {
    if (!record) return "--:--";
    return format(new Date(record.timestamp), "HH:mm");
  };

  return (
    <Card className="shadow-xl border-2 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Relatório Diário de Presença</CardTitle>
            <CardDescription>Visualize quem bateu ou não bateu ponto em um dia específico</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Selecione o Dia</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Carregando registros...</div>
        ) : (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{employees.length}</p>
                <p className="text-sm text-gray-500 mt-1">Total Funcionários</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <p className="text-3xl font-bold text-green-600">{bateram.length}</p>
                <p className="text-sm text-green-600 mt-1">Bateram Ponto</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <p className="text-3xl font-bold text-red-600">{naoBateram.length}</p>
                <p className="text-sm text-red-600 mt-1">Sem Registro</p>
              </div>
            </div>

            {/* Funcionários que bateram ponto */}
            {bateram.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Registros de Ponto — {format(parseISO(selectedDate), "dd/MM/yyyy", { locale: ptBR })}
                  </h3>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        <th className="text-left px-4 py-2 font-semibold">Funcionário</th>
                        <th className="text-center px-3 py-2 font-semibold">Entrada</th>
                        <th className="text-center px-3 py-2 font-semibold">Pausa</th>
                        <th className="text-center px-3 py-2 font-semibold">Retorno</th>
                        <th className="text-center px-3 py-2 font-semibold">Saída</th>
                        <th className="text-center px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bateram.map((emp) => (
                        <tr key={emp.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{emp.full_name}</p>
                            {emp.employee_number && (
                              <p className="text-xs text-gray-400">Matrícula: {emp.employee_number}</p>
                            )}
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`font-mono font-semibold ${emp.entrada ? "text-green-600" : "text-gray-400"}`}>
                              {formatTime(emp.entrada)}
                            </span>
                            {emp.entrada && emp.entrada.status === "atrasado" && (
                              <div className="text-xs text-orange-500 mt-1">+{emp.entrada.delay_minutes}min</div>
                            )}
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`font-mono ${emp.pausa ? "text-gray-700 dark:text-gray-300" : "text-gray-300"}`}>
                              {formatTime(emp.pausa)}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`font-mono ${emp.retorno ? "text-gray-700 dark:text-gray-300" : "text-gray-300"}`}>
                              {formatTime(emp.retorno)}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`font-mono font-semibold ${emp.saida ? "text-red-600" : "text-gray-300"}`}>
                              {formatTime(emp.saida)}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            <div className="flex flex-col items-center gap-1">
                              {getStatusBadge(emp.entrada)}
                              {!emp.saida && emp.entrada && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Em serviço
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Funcionários sem ponto */}
            {naoBateram.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Sem Registro de Ponto
                  </h3>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {naoBateram.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg"
                    >
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{emp.full_name}</p>
                        {emp.employee_number && (
                          <p className="text-xs text-gray-400">Mat.: {emp.employee_number}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {employees.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                Nenhum funcionário ativo encontrado.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}