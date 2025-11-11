import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Reports() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.TimeRecord.filter({ company_id: user.company_id }, '-timestamp') : [],
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const exportFullReport = () => {
    const headers = ['Funcionário', 'CPF', 'Tipo', 'Data/Hora', 'Status', 'Atraso (min)', 'Localização'];
    const rows = timeRecords.map(record => {
      const employee = employees.find(e => e.id === record.employee_id);
      return [
        employee?.full_name || 'Desconhecido',
        employee?.cpf || '-',
        record.type,
        format(parseISO(record.timestamp), 'dd/MM/yyyy HH:mm:ss'),
        record.status,
        record.delay_minutes || 0,
        record.latitude && record.longitude ? `${record.latitude},${record.longitude}` : '-'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-completo-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportEmployeesSummary = () => {
    const headers = ['Funcionário', 'CPF', 'Total Registros', 'Pontual', 'Atrasado', 'Total Atraso (min)'];
    const rows = employees.map(employee => {
      const empRecords = timeRecords.filter(r => r.employee_id === employee.id);
      const onTime = empRecords.filter(r => r.status === 'pontual').length;
      const late = empRecords.filter(r => r.status === 'atrasado').length;
      const totalDelay = empRecords.reduce((sum, r) => sum + (r.delay_minutes || 0), 0);
      
      return [
        employee.full_name,
        employee.cpf,
        empRecords.length,
        onTime,
        late,
        totalDelay
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-funcionarios-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Relatórios</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Exporte relatórios em CSV
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Relatório Completo</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Todos os registros de ponto
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Exporta todos os registros com detalhes completos incluindo funcionário, horário, status e localização.
            </p>
            <Button
              onClick={exportFullReport}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-400"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Relatório Completo
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-400 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Resumo por Funcionário</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Estatísticas individuais
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Exporta um resumo com estatísticas de cada funcionário incluindo total de registros, pontualidade e atrasos.
            </p>
            <Button
              onClick={exportEmployeesSummary}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-400"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Resumo de Funcionários
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}