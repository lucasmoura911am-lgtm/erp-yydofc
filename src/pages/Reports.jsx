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

  <table class="timesheet">
    <thead>
      <tr>
        <th rowspan="2">Data</th>
        <th colspan="4">Jornada Prevista</th>
        <th colspan="4">Registros de Ponto</th>
        <th rowspan="2">Trabalhadas</th>
        <th rowspan="2">Observação</th>
      </tr>
      <tr>
        <th>Ent.</th>
        <th>Sai.</th>
        <th>Ent.</th>
        <th>Sai.</th>
        <th>Ent.</th>
        <th>Sai.</th>
        <th>Ent.</th>
        <th>Sai.</th>
      </tr>
    </thead>
    <tbody>
      ${(() => {
        // Agrupar registros por dia
        const dayRecords = {};
        monthRecords.forEach(record => {
          const day = format(new Date(record.timestamp), 'yyyy-MM-dd');
          if (!dayRecords[day]) dayRecords[day] = [];
          dayRecords[day].push(record);
        });

        // Gerar todas as linhas do mês
        const daysInMonth = [];
        const currentDay = new Date(monthStart);
        while (currentDay <= monthEnd) {
          daysInMonth.push(new Date(currentDay));
          currentDay.setDate(currentDay.getDate() + 1);
        }

        return daysInMonth.map(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const records = (dayRecords[dayKey] || []).sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          const dayName = format(day, 'EEE', { locale: ptBR });
          const dateStr = format(day, 'dd/MM/yy');
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          
          // Jornada prevista (da escala)
          const shiftStart = employeeShift?.start_time || '08:00';
          const shiftEnd = employeeShift?.end_time || '18:00';
          const breakTime = employeeShift?.break_minutes || 60;
          const lunchStart = '12:00';
          const lunchEnd = '13:00';

          // Registros reais
          const entrada1 = records.find(r => r.type === 'entrada');
          const saida1 = records.find(r => r.type === 'pausa');
          const entrada2 = records.find(r => r.type === 'retorno');
          const saida2 = records.find(r => r.type === 'saida');

          // CÁLCULO CORRETO: (pausa - entrada) + (saida - retorno)
          let horasTrabalhadas = '--:--';
          let obs = '';
          
          if (records.length > 0) {
            const hasManual = records.some(r => r.is_manual);
            if (hasManual) obs += '* Manual ';
            
            if (entrada1 && saida1 && entrada2 && saida2) {
              // REGRA CORRETA CLT: soma dos períodos trabalhados
              const toMinutes = (timestamp) => {
                const d = new Date(timestamp);
                return d.getHours() * 60 + d.getMinutes();
              };
              
              const morning = toMinutes(saida1.timestamp) - toMinutes(entrada1.timestamp);
              const afternoon = toMinutes(saida2.timestamp) - toMinutes(entrada2.timestamp);
              const workedMin = Math.max(0, morning) + Math.max(0, afternoon);
              
              const hours = Math.floor(workedMin / 60);
              const mins = Math.floor(workedMin % 60);
              horasTrabalhadas = hours.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
            } else if (entrada1 && saida2) {
              // Fallback: sem pausa registrada
              const totalMin = (new Date(saida2.timestamp) - new Date(entrada1.timestamp)) / 60000;
              const workedMin = totalMin > 240 ? Math.max(0, totalMin - breakTime) : totalMin;
              const hours = Math.floor(workedMin / 60);
              const mins = Math.floor(workedMin % 60);
              horasTrabalhadas = hours.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
              obs += 'Sem pausa ';
            } else {
              obs += 'Incompleto ';
            }
          } else if (isWeekend) {
            obs = '';
          } else {
            obs = 'Ausente';
          }

          return `
            <tr>
              <td class="date-col">${dateStr} ${dayName}</td>
              <td class="time-cell">${shiftStart}</td>
              <td class="time-cell">${lunchStart}</td>
              <td class="time-cell">${lunchEnd}</td>
              <td class="time-cell">${shiftEnd}</td>
              <td class="time-cell">${entrada1 ? format(new Date(entrada1.timestamp), 'HH:mm') : '--:--'}</td>
              <td class="time-cell">${saida1 ? format(new Date(saida1.timestamp), 'HH:mm') : '--:--'}</td>
              <td class="time-cell">${entrada2 ? format(new Date(entrada2.timestamp), 'HH:mm') : '--:--'}</td>
              <td class="time-cell">${saida2 ? format(new Date(saida2.timestamp), 'HH:mm') : '--:--'}</td>
              <td class="time-cell"><strong>${horasTrabalhadas}</strong></td>
              <td class="obs-cell">${obs}</td>
            </tr>
          `;
        }).join('');
      })()}
    </tbody>
  </table>

  <div class="clt-summary">
    <h4>CÁLCULOS CLT - CONSOLIDADO MENSAL</h4>
    <div class="clt-grid">
      <div class="clt-item">
        <div class="clt-value">${cltCalc.totalWorkedHours}</div>
        <div class="clt-label">Total Trabalhado</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.overtime50Hours}</div>
        <div class="clt-label">HE 50%</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.overtime100Hours}</div>
        <div class="clt-label">HE 100%</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.nightHours}</div>
        <div class="clt-label">Adicional Noturno</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.sundayHolidayHours}</div>
        <div class="clt-label">Feriado/Domingo</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.dsrDays} dias</div>
        <div class="clt-label">DSR</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.averageDailyHours}</div>
        <div class="clt-label">Média Diária</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.totalDelayHours}</div>
        <div class="clt-label">Total Atrasos</div>
      </div>
    </div>
  </div>

  <div class="totals-section">
    <strong>TOTAIS DO PERÍODO</strong>
    <div class="totals-grid">
      <div class="totals-box">
        <h4>Horas</h4>
        <div class="total-line">
          <span>A Trabalhar:</span>
          <strong>${cltCalc.expectedHours}</strong>
        </div>
        <div class="total-line">
          <span>Trabalhadas:</span>
          <strong>${cltCalc.totalWorkedHours}</strong>
        </div>
        <div class="total-line">
          <span>Extras 50%:</span>
          <strong>${cltCalc.overtime50Hours}</strong>
        </div>
        <div class="total-line">
          <span>Extras 100%:</span>
          <strong>${cltCalc.overtime100Hours}</strong>
        </div>
      </div>
      <div class="totals-box">
        <h4>Adicionais</h4>
        <div class="total-line">
          <span>DSR:</span>
          <strong>${cltCalc.dsrDays} dias (${cltCalc.dsrHours}h)</strong>
        </div>
        <div class="total-line">
          <span>Adicional Noturno:</span>
          <strong>${cltCalc.nightHours}</strong>
        </div>
        <div class="total-line">
          <span>Feriado/Domingo:</span>
          <strong>${cltCalc.sundayHolidayHours}</strong>
        </div>
        <div class="total-line">
          <span>Atrasos:</span>
          <strong>${cltCalc.totalDelayHours}</strong>
        </div>
        <div class="total-line">
          <span>Faltas/Ausências:</span>
          <strong>${cltCalc.absenceHours}</strong>
        </div>
      </div>
    </div>
  </div>

  <div class="signature-section">
    <div class="signature-text">
      Concordo plenamente com as marcações acima efetuadas por mim, sendo que expressam o ocorrido no período.
    </div>
    
    <div class="signature-boxes">
      <div class="signature-box">
        <div class="signature-line">
          Assinatura do Funcionário
        </div>
        <div style="margin-top: 10px; font-size: 9pt;">
          <strong>${employee.full_name}</strong>
        </div>
        <div style="font-size: 8pt; color: #666;">
          CPF: ${employee.cpf}
        </div>
      </div>
      
      <div class="signature-box">
        <div class="signature-line">
          Assinatura do Gestor
        </div>
      </div>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 10px;">
      Documento gerado automaticamente pelo sistema PontoFlex em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
    </div>
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