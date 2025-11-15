import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, FileText, Calendar, User } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Reports() {
  const [user, setUser] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.TimeRecord.list('-timestamp') : [],
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const { data: company } = useQuery({
    queryKey: ['company', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return null;
      const companies = await base44.entities.Company.filter({ id: user.company_id });
      return companies[0] || null;
    },
    enabled: !!user?.company_id,
  });

  const exportFullReport = () => {
    let csv = 'Data/Hora,Funcionário,CPF,Tipo,Status,Atraso (min),Latitude,Longitude,Endereço\n';
    
    timeRecords.forEach(record => {
      const employee = employees.find(e => e.id === record.employee_id);
      const employeeName = employee ? employee.full_name : 'Desconhecido';
      const employeeCPF = employee ? employee.cpf : '-';
      const timestamp = format(new Date(record.timestamp), "dd/MM/yyyy HH:mm:ss");
      
      csv += `${timestamp},${employeeName},${employeeCPF},${record.type},${record.status},${record.delay_minutes || 0},${record.latitude || '-'},${record.longitude || '-'},"${record.location_address || '-'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_completo_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportEmployeesSummary = () => {
    let csv = 'Funcionário,CPF,Total de Registros,Pontuais,Atrasados,Total Atraso (min)\n';
    
    employees.forEach(employee => {
      const empRecords = timeRecords.filter(r => r.employee_id === employee.id);
      const punctual = empRecords.filter(r => r.status === 'pontual').length;
      const late = empRecords.filter(r => r.status === 'atrasado').length;
      const totalDelay = empRecords.reduce((sum, r) => sum + (r.delay_minutes || 0), 0);
      
      csv += `${employee.full_name},${employee.cpf},${empRecords.length},${punctual},${late},${totalDelay}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resumo_funcionarios_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const generateMonthlyReport = () => {
    if (!selectedEmployee || !selectedMonth) {
      alert('Selecione um funcionário e um mês');
      return;
    }

    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;

    const [year, month] = selectedMonth.split('-');
    const monthStart = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const monthEnd = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));

    const monthRecords = timeRecords.filter(record => {
      const recordDate = new Date(record.timestamp);
      return record.employee_id === selectedEmployee && 
             recordDate >= monthStart && 
             recordDate <= monthEnd;
    });

    // Gerar HTML para impressão
    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório de Ponto - ${employee.full_name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #333;
      padding-bottom: 20px;
    }
    .company-info {
      margin-bottom: 20px;
    }
    .employee-info {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .employee-info h3 {
      margin-top: 0;
      color: #6366f1;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    .info-item {
      display: flex;
      gap: 10px;
    }
    .info-label {
      font-weight: bold;
      color: #555;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border: 1px solid #ddd;
    }
    th {
      background-color: #6366f1;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .summary {
      background: #f0f9ff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid #3b82f6;
    }
    .summary h3 {
      margin-top: 0;
      color: #1e40af;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-top: 15px;
    }
    .summary-item {
      text-align: center;
      padding: 15px;
      background: white;
      border-radius: 6px;
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      color: #1e40af;
    }
    .summary-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .signature {
      margin-top: 60px;
      border-top: 2px solid #333;
      padding-top: 40px;
    }
    .signature-line {
      margin-top: 60px;
      border-top: 1px solid #333;
      width: 400px;
      text-align: center;
      padding-top: 10px;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
    }
    .badge-entrada { background: #dcfce7; color: #166534; }
    .badge-saida { background: #fee2e2; color: #991b1b; }
    .badge-pausa { background: #fef3c7; color: #92400e; }
    .badge-retorno { background: #dbeafe; color: #1e40af; }
    .badge-pontual { background: #dcfce7; color: #166534; }
    .badge-atrasado { background: #fed7aa; color: #9a3412; }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #666;
      font-size: 12px;
      border-top: 1px solid #ddd;
      padding-top: 20px;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RELATÓRIO DE PONTO MENSAL</h1>
    <p>${format(monthStart, "MMMM 'de' yyyy", { locale: ptBR }).toUpperCase()}</p>
  </div>

  <div class="company-info">
    <h3>Dados da Empresa</h3>
    <p><strong>Empresa:</strong> ${company?.name || 'N/A'}</p>
    <p><strong>CNPJ:</strong> ${company?.cnpj || 'N/A'}</p>
    ${company?.address ? `<p><strong>Endereço:</strong> ${company.address}</p>` : ''}
  </div>

  <div class="employee-info">
    <h3>Dados do Funcionário</h3>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nome:</span>
        <span>${employee.full_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">CPF:</span>
        <span>${employee.cpf}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Matrícula:</span>
        <span>${employee.employee_number || 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Telefone:</span>
        <span>${employee.phone || 'N/A'}</span>
      </div>
    </div>
  </div>

  <div class="summary">
    <h3>Resumo do Período</h3>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${monthRecords.length}</div>
        <div class="summary-label">Total de Registros</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${monthRecords.filter(r => r.status === 'pontual').length}</div>
        <div class="summary-label">Pontuais</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${monthRecords.filter(r => r.status === 'atrasado').length}</div>
        <div class="summary-label">Atrasos</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${monthRecords.reduce((sum, r) => sum + (r.delay_minutes || 0), 0)}</div>
        <div class="summary-label">Min. de Atraso</div>
      </div>
    </div>
  </div>

  <h3>Registros Detalhados</h3>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Hora</th>
        <th>Tipo</th>
        <th>Status</th>
        <th>Atraso (min)</th>
        <th>Localização</th>
      </tr>
    </thead>
    <tbody>
      ${monthRecords.map(record => `
        <tr>
          <td>${format(new Date(record.timestamp), 'dd/MM/yyyy')}</td>
          <td>${format(new Date(record.timestamp), 'HH:mm:ss')}</td>
          <td><span class="badge badge-${record.type}">${record.type}</span></td>
          <td><span class="badge badge-${record.status}">${record.status}</span></td>
          <td>${record.delay_minutes || 0}</td>
          <td>${record.latitude && record.longitude ? `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}` : 'N/A'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="signature">
    <p><strong>Declaração:</strong></p>
    <p>Declaro que os registros de ponto acima conferem com minha jornada de trabalho no período mencionado.</p>
    
    <div class="signature-line">
      <p><strong>${employee.full_name}</strong></p>
      <p>CPF: ${employee.cpf}</p>
    </div>

    <div style="margin-top: 40px;">
      <p>Local e Data: ________________, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
    </div>
  </div>

  <div class="footer">
    <p>Relatório gerado automaticamente pelo sistema PontoFlex</p>
    <p>Data de geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
  </div>

  <div class="no-print" style="position: fixed; bottom: 20px; right: 20px;">
    <button onclick="window.print()" style="background: #6366f1; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
      🖨️ Imprimir / Salvar PDF
    </button>
  </div>
</body>
</html>
    `;

    // Abrir em nova janela
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHTML);
    printWindow.document.close();
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Relatórios</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Exporte relatórios e documentos para análise
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Relatório Completo */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Relatório Completo</CardTitle>
                <CardDescription>Todos os registros de ponto em CSV</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Exporta todos os registros de ponto com informações detalhadas de data, hora, funcionário, tipo, status, atrasos e localização.
            </p>
            <Button 
              onClick={exportFullReport}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV Completo
            </Button>
          </CardContent>
        </Card>

        {/* Resumo por Funcionário */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <User className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <CardTitle>Resumo por Funcionário</CardTitle>
                <CardDescription>Estatísticas agregadas em CSV</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Exporta um resumo com estatísticas de cada funcionário: total de registros, pontuais, atrasos e tempo total de atraso.
            </p>
            <Button 
              onClick={exportEmployeesSummary}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Resumo CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Relatório Mensal Individual */}
      <Card className="shadow-xl border-2 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Relatório Mensal para Assinatura</CardTitle>
              <CardDescription>Documento oficial para conferência e assinatura do funcionário</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gera um relatório completo e formatado com todos os registros de ponto do mês, incluindo dados do funcionário, empresa, resumo estatístico e espaço para assinatura. Pronto para impressão ou exportação em PDF.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} - {emp.employee_number || 'Sem matrícula'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    const value = format(date, 'yyyy-MM');
                    const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
                    return (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={generateMonthlyReport}
            disabled={!selectedEmployee || !selectedMonth}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            size="lg"
          >
            <FileText className="w-5 h-5 mr-2" />
            Gerar Relatório para Assinatura
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}