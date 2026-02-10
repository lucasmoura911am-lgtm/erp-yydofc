import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, FileText, Calendar, User } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateCLTHours, formatCurrency } from "../components/reports/CLTCalculator";
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

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Shift.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const getMoodEmoji = (mood) => {
    const moods = {
      muito_feliz: "😄",
      feliz: "😊",
      neutro: "😐",
      triste: "😔",
      muito_triste: "😢"
    };
    return moods[mood] || "";
  };

  const getMoodLabel = (mood) => {
    const labels = {
      muito_feliz: "Muito Feliz",
      feliz: "Feliz",
      neutro: "Neutro",
      triste: "Triste",
      muito_triste: "Muito Triste"
    };
    return labels[mood] || "";
  };

  const exportFullReport = () => {
    let csv = 'Data/Hora,Funcionário,CPF,Tipo,Status,Atraso (min),Humor,Latitude,Longitude,Endereço\n';
    
    timeRecords.forEach(record => {
      const employee = employees.find(e => e.id === record.employee_id);
      const employeeName = employee ? employee.full_name : 'Desconhecido';
      const employeeCPF = employee ? employee.cpf : '-';
      const timestamp = format(new Date(record.timestamp), "dd/MM/yyyy HH:mm:ss");
      const moodText = record.mood ? getMoodLabel(record.mood) : '-';
      
      csv += `${timestamp},${employeeName},${employeeCPF},${record.type},${record.status},${record.delay_minutes || 0},${moodText},${record.latitude || '-'},${record.longitude || '-'},"${record.location_address || '-'}"\n`;
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
      const recordDate = parseISO(record.timestamp);
      return record.employee_id === selectedEmployee && 
             recordDate >= monthStart && 
             recordDate <= monthEnd;
    });

    // Buscar escala do funcionário
    const employeeShift = shifts.find(s => s.id === employee.shift_id);

    // Calcular horas CLT
    const cltCalc = calculateCLTHours(monthRecords, employeeShift, []);
    
    // Valor base por hora (exemplo, ajustar conforme salário real)
    const hourlyRate = 20; // R$ 20/hora base
    const he50Value = (cltCalc.overtime50Minutes / 60) * hourlyRate * 1.5;
    const he100Value = (cltCalc.overtime100Minutes / 60) * hourlyRate * 2;
    const nightValue = (cltCalc.nightMinutes / 60) * hourlyRate * 0.2; // 20% adicional
    const sundayValue = (cltCalc.sundayHolidayMinutes / 60) * hourlyRate * 2;

    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório de Cartão Ponto Individual - ${employee.full_name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      padding: 20px;
      max-width: 100%;
      margin: 0 auto;
      color: #000;
    }
    .page-header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
    }
    .page-header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .period-info {
      font-size: 9pt;
      margin-bottom: 3px;
    }
    .company-section {
      border: 1px solid #000;
      padding: 10px;
      margin-bottom: 10px;
      background: #f9f9f9;
    }
    .company-section h3 {
      font-size: 10pt;
      margin-bottom: 8px;
      border-bottom: 1px solid #666;
      padding-bottom: 4px;
    }
    .info-row {
      display: flex;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .info-row strong {
      min-width: 100px;
      font-weight: bold;
    }
    .employee-section {
      border: 1px solid #000;
      padding: 10px;
      margin-bottom: 10px;
      background: #fff;
    }
    .employee-section h3 {
      font-size: 10pt;
      margin-bottom: 8px;
      border-bottom: 1px solid #666;
      padding-bottom: 4px;
    }
    .legend {
      font-size: 8pt;
      margin-bottom: 10px;
      padding: 8px;
      background: #f0f0f0;
      border: 1px solid #ccc;
    }
    .legend strong {
      font-weight: bold;
    }
    table.timesheet {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 8pt;
    }
    table.timesheet th {
      background-color: #333;
      color: white;
      padding: 6px 4px;
      text-align: center;
      border: 1px solid #000;
      font-weight: bold;
      font-size: 8pt;
    }
    table.timesheet td {
      padding: 4px;
      text-align: center;
      border: 1px solid #666;
    }
    table.timesheet tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    table.timesheet .date-col {
      text-align: left;
      padding-left: 6px;
    }
    table.timesheet .time-cell {
      font-family: 'Courier New', monospace;
      font-size: 8pt;
    }
    table.timesheet .obs-cell {
      text-align: left;
      font-size: 7pt;
      padding-left: 4px;
    }
    .totals-section {
      border: 1px solid #000;
      padding: 10px;
      margin-bottom: 15px;
      background: #f9f9f9;
    }
    .totals-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 10px;
    }
    .totals-box {
      border: 1px solid #666;
      padding: 8px;
      background: white;
    }
    .totals-box h4 {
      font-size: 9pt;
      margin-bottom: 6px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 3px;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      margin-bottom: 3px;
    }
    .total-line strong {
      font-weight: bold;
    }
    .signature-section {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #000;
    }
    .signature-text {
      font-size: 9pt;
      margin-bottom: 40px;
      text-align: justify;
    }
    .signature-boxes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 50px;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #000;
      padding-top: 8px;
      margin-top: 60px;
      font-size: 9pt;
    }
    .clt-summary {
      border: 2px solid #000;
      padding: 10px;
      margin-bottom: 15px;
      background: #e8f5e9;
    }
    .clt-summary h4 {
      font-size: 10pt;
      margin-bottom: 8px;
      font-weight: bold;
    }
    .clt-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 8px;
    }
    .clt-item {
      text-align: center;
      padding: 6px;
      background: white;
      border: 1px solid #666;
    }
    .clt-value {
      font-size: 11pt;
      font-weight: bold;
      color: #2e7d32;
    }
    .clt-label {
      font-size: 7pt;
      color: #666;
      margin-top: 2px;
    }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>RELATÓRIO DE CARTÃO PONTO INDIVIDUAL</h1>
    <div class="period-info">
      Período de ${format(monthStart, "dd/MM/yyyy")} à ${format(monthEnd, "dd/MM/yyyy")} - 
      Data Emissão: ${format(new Date(), "dd/MM/yyyy")} - Pág.: 1
    </div>
  </div>

  <div class="company-section">
    <h3>DADOS DA EMPRESA</h3>
    <div class="info-row">
      <strong>Empresa:</strong>
      <span>${company?.name || 'N/A'}</span>
    </div>
    <div class="info-row">
      <strong>CNPJ:</strong>
      <span>${company?.cnpj || 'N/A'}</span>
    </div>
    ${company?.address ? `
    <div class="info-row">
      <strong>Endereço:</strong>
      <span>${company.address}</span>
    </div>
    ` : ''}
  </div>

  <div class="employee-section">
    <h3>FUNCIONÁRIO</h3>
    <div class="info-row">
      <strong>Nome:</strong>
      <span>${employee.full_name}</span>
    </div>
    <div class="info-row">
      <strong>Matrícula:</strong>
      <span>${employee.employee_number || 'N/A'}</span>
    </div>
    <div class="info-row">
      <strong>CPF:</strong>
      <span>${employee.cpf}</span>
    </div>
    <div class="info-row">
      <strong>Data Admissão:</strong>
      <span>${employee.hire_date ? format(new Date(employee.hire_date), 'dd/MM/yyyy') : 'N/A'}</span>
    </div>
  </div>

  <div class="legend">
    <strong>Legenda:</strong> 
    F - Feriado | 
    * - Marcações Alteradas | 
    M - Manual | 
    A - Ausência
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

  <div class="summary" style="background: #f0fdf4; border-left-color: #16a34a;">
    <h3 style="color: #15803d;">📋 Cálculos CLT - Consolidado Mensal</h3>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value" style="color: #15803d;">${cltCalc.totalWorkedHours}</div>
        <div class="summary-label">Total Trabalhado</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #15803d;">${cltCalc.expectedHours}</div>
        <div class="summary-label">Horas Esperadas</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #ea580c;">${cltCalc.overtime50Hours}</div>
        <div class="summary-label">Horas Extras 50%</div>
        <div class="summary-label" style="font-size: 10px; color: #ea580c;">${formatCurrency(he50Value)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #dc2626;">${cltCalc.overtime100Hours}</div>
        <div class="summary-label">Horas Extras 100%</div>
        <div class="summary-label" style="font-size: 10px; color: #dc2626;">${formatCurrency(he100Value)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #7c3aed;">${cltCalc.nightHours}</div>
        <div class="summary-label">Adicional Noturno</div>
        <div class="summary-label" style="font-size: 10px; color: #7c3aed;">${formatCurrency(nightValue)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #0891b2;">${cltCalc.sundayHolidayHours}</div>
        <div class="summary-label">Feriado/Domingo</div>
        <div class="summary-label" style="font-size: 10px; color: #0891b2;">${formatCurrency(sundayValue)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #059669;">${cltCalc.dsrDays} dias</div>
        <div class="summary-label">DSR (Descanso)</div>
        <div class="summary-label" style="font-size: 10px;">${cltCalc.dsrHours}h remuneradas</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: ${cltCalc.exceedsMaxJourney ? '#dc2626' : '#059669'};">${cltCalc.averageDailyHours}</div>
        <div class="summary-label">Média Diária</div>
        <div class="summary-label" style="font-size: 10px; color: ${cltCalc.exceedsMaxJourney ? '#dc2626' : '#666'};">
          ${cltCalc.exceedsMaxJourney ? '⚠️ Excede 10h/dia' : '✓ Dentro do limite'}
        </div>
      </div>
    </div>
    <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 6px;">
      <p style="margin: 0; font-size: 13px; color: #666;">
        <strong>Observações CLT:</strong>
      </p>
      <ul style="margin: 8px 0 0 20px; font-size: 12px; color: #666; line-height: 1.6;">
        <li>HE 50%: Primeiras 2 horas extras por dia</li>
        <li>HE 100%: Horas extras além das primeiras 2h</li>
        <li>Adicional Noturno: 22h às 5h (20% sobre hora normal)</li>
        <li>Trabalho em Domingo/Feriado: 100% sobre hora normal</li>
        <li>DSR: Descanso Semanal Remunerado (sábados/domingos não trabalhados)</li>
        <li>Jornada Máxima: 10 horas/dia (incluindo extras)</li>
      </ul>
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
        <th>Humor</th>
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
          <td><span class="mood-emoji">${record.mood ? getMoodEmoji(record.mood) + ' ' + getMoodLabel(record.mood) : '-'}</span></td>
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
              Exporta todos os registros de ponto com informações detalhadas de data, hora, funcionário, tipo, status, humor, atrasos e localização.
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
            Gera um relatório completo e formatado com todos os registros de ponto do mês, incluindo dados do funcionário, empresa, humor registrado, resumo estatístico e espaço para assinatura. Pronto para impressão ou exportação em PDF.
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