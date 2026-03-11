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
  const [managerReportMonth, setManagerReportMonth] = useState(format(new Date(), 'yyyy-MM'));

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

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Department.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Position.filter({ company_id: user.company_id }) : [],
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
      
      // Filtrar por data de contratação do funcionário
      const hireDate = employee.hire_date ? new Date(employee.hire_date + 'T00:00:00') : null;
      const isAfterHire = !hireDate || recordDate >= hireDate;
      
      return record.employee_id === selectedEmployee && 
             recordDate >= monthStart && 
             recordDate <= monthEnd &&
             isAfterHire;
    });

    // Buscar escala do funcionário
    const employeeShift = shifts.find(s => s.id === employee.shift_id);

    // Calcular horas CLT com salário mensal (se disponível)
    const monthlySalary = 2000; // Ajustar conforme salário real do funcionário
    const cltCalc = calculateCLTHours(monthRecords, employeeShift, [], monthlySalary);

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
      <strong>Nome Empresa:</strong>
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
    <h3>DADOS DO FUNCIONÁRIO</h3>
    <div class="info-row">
      <strong>Nome:</strong>
      <span>${employee.full_name}</span>
    </div>
    <div class="info-row">
      <strong>CPF:</strong>
      <span>${employee.cpf || 'N/A'}</span>
    </div>
    <div class="info-row">
      <strong>PIS:</strong>
      <span>${employee.pis_number || 'N/A'}</span>
    </div>
    <div class="info-row">
      <strong>Matrícula:</strong>
      <span>${employee.employee_number || 'N/A'}</span>
    </div>
    <div class="info-row">
      <strong>Data Admissão:</strong>
      <span>${employee.hire_date ? format(new Date(employee.hire_date), 'dd/MM/yyyy') : 'N/A'}</span>
    </div>
    ${(() => {
      const dept = departments.find(d => d.id === employee.department_id);
      return dept ? `
      <div class="info-row">
        <strong>Departamento:</strong>
        <span>${dept.name}</span>
      </div>
      ` : '';
    })()}
    <div class="info-row">
      <strong>Função:</strong>
      <span>${employee.job_function || (positions.find(p => p.id === employee.position_id)?.name) || 'N/A'}</span>
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
        <th rowspan="2">Extras/Déf.</th>
        <th rowspan="2">Obs.</th>
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

        // Verificar dias de trabalho da escala
        const workDaysMap = {
          'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
          'friday': 5, 'saturday': 6, 'sunday': 0
        };
        const shiftWorkDays = employeeShift?.work_days?.map(d => workDaysMap[d]) || [1, 2, 3, 4, 5];

        // Gerar todas as linhas do mês
        const daysInMonth = [];
        const currentDay = new Date(monthStart);
        while (currentDay <= monthEnd) {
          daysInMonth.push(new Date(currentDay));
          currentDay.setDate(currentDay.getDate() + 1);
        }

        return daysInMonth.map(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          
          // Não mostrar dias anteriores à contratação
          const hireDate = employee.hire_date ? new Date(employee.hire_date + 'T00:00:00') : null;
          if (hireDate && day < hireDate) {
            return ''; // Pular dias antes da contratação
          }

          // Verificar se é dia de trabalho conforme escala
          const dayOfWeek = day.getDay();
          const isWorkDay = shiftWorkDays.includes(dayOfWeek);
          
          const records = (dayRecords[dayKey] || []).sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          const dayName = format(day, 'EEE', { locale: ptBR });
          const dateStr = format(day, 'dd/MM/yy');
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          
          // Jornada prevista (da escala) - só mostrar se for dia de trabalho
          const shiftStart = isWorkDay ? (employeeShift?.start_time || '08:00') : '';
          const shiftEnd = isWorkDay ? (employeeShift?.end_time || '18:00') : '';
          const breakTime = employeeShift?.break_minutes || 60;
          const lunchStart = isWorkDay ? '12:00' : '';
          const lunchEnd = isWorkDay ? '13:00' : '';

          // Registros reais
          const entrada1 = records.find(r => r.type === 'entrada');
          const saida1 = records.find(r => r.type === 'pausa');
          const entrada2 = records.find(r => r.type === 'retorno');
          const saida2 = records.find(r => r.type === 'saida');

          // CÁLCULO CORRETO: (pausa - entrada) + (saida - retorno)
          let horasTrabalhadas = '--:--';
          let extrasDeficit = '';
          let obs = '';
          
          if (records.length > 0) {
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
              
              // Calcular extras ou déficit
              if (isWorkDay) {
                const expectedMin = 480; // 8h
                const diff = workedMin - expectedMin;
                if (diff > 0) {
                  const extraH = Math.floor(diff / 60);
                  const extraM = Math.floor(diff % 60);
                  extrasDeficit = `+${extraH}:${extraM.toString().padStart(2, '0')}`;
                } else if (diff < 0) {
                  const defH = Math.floor(Math.abs(diff) / 60);
                  const defM = Math.floor(Math.abs(diff) % 60);
                  extrasDeficit = `-${defH}:${defM.toString().padStart(2, '0')}`;
                }
              }
            } else if (entrada1 && saida2) {
              // Fallback: sem pausa registrada
              const totalMin = (new Date(saida2.timestamp) - new Date(entrada1.timestamp)) / 60000;
              const workedMin = totalMin > 240 ? Math.max(0, totalMin - breakTime) : totalMin;
              const hours = Math.floor(workedMin / 60);
              const mins = Math.floor(workedMin % 60);
              horasTrabalhadas = hours.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
              obs += 'Sem pausa ';
              
              // Calcular extras ou déficit
              if (isWorkDay) {
                const expectedMin = 480;
                const diff = workedMin - expectedMin;
                if (diff > 0) {
                  const extraH = Math.floor(diff / 60);
                  const extraM = Math.floor(diff % 60);
                  extrasDeficit = `+${extraH}:${extraM.toString().padStart(2, '0')}`;
                } else if (diff < 0) {
                  const defH = Math.floor(Math.abs(diff) / 60);
                  const defM = Math.floor(Math.abs(diff) % 60);
                  extrasDeficit = `-${defH}:${defM.toString().padStart(2, '0')}`;
                }
              }
            } else {
              obs += 'Incompleto ';
            }
          } else if (!isWorkDay) {
            obs = '';
          } else {
            obs = 'Ausente';
            if (isWorkDay) {
              extrasDeficit = '-8:00';
            }
          }

          return `
            <tr>
              <td class="date-col">${dateStr} ${dayName}</td>
              <td class="time-cell">${shiftStart || '--:--'}</td>
              <td class="time-cell">${lunchStart || '--:--'}</td>
              <td class="time-cell">${lunchEnd || '--:--'}</td>
              <td class="time-cell">${shiftEnd || '--:--'}</td>
              <td class="time-cell">${entrada1 ? format(new Date(entrada1.timestamp), 'HH:mm') : '--:--'}</td>
              <td class="time-cell">${saida1 ? format(new Date(saida1.timestamp), 'HH:mm') : '--:--'}</td>
              <td class="time-cell">${entrada2 ? format(new Date(entrada2.timestamp), 'HH:mm') : '--:--'}</td>
              <td class="time-cell">${saida2 ? format(new Date(saida2.timestamp), 'HH:mm') : '--:--'}</td>
              <td class="time-cell"><strong>${horasTrabalhadas}</strong></td>
              <td class="time-cell" style="color: ${extrasDeficit.startsWith('+') ? '#059669' : extrasDeficit.startsWith('-') ? '#dc2626' : '#000'}"><strong>${extrasDeficit || '--:--'}</strong></td>
              <td class="obs-cell">${obs}</td>
            </tr>
          `;
        }).join('');
      })()}
    </tbody>
  </table>

  <div class="clt-summary">
    <h4>CÁLCULOS CLT - CONSOLIDADO MENSAL (Art. 58, 59, 67, 71, 73 CLT | Lei 605/49)</h4>
    <div class="clt-grid" style="grid-template-columns: repeat(5, 1fr);">
      <div class="clt-item">
        <div class="clt-value">${cltCalc.expectedHours}</div>
        <div class="clt-label">Jornada Prevista<br/>(8h/dia, 44h/sem)</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.totalWorkedHours}</div>
        <div class="clt-label">Total Trabalhado</div>
      </div>
      <div class="clt-item">
        <div class="clt-value" style="color: ${cltCalc.overtime50Minutes > 0 ? '#d97706' : '#666'}">${cltCalc.overtime50Hours}</div>
        <div class="clt-label">HE 50% (dias úteis)</div>
      </div>
      <div class="clt-item">
        <div class="clt-value" style="color: ${cltCalc.overtime100Minutes > 0 ? '#dc2626' : '#666'}">${cltCalc.overtime100Hours}</div>
        <div class="clt-label">HE 100% (dom/fer)</div>
      </div>
      <div class="clt-item">
        <div class="clt-value" style="color: #059669">${cltCalc.dsrReflexHours}</div>
        <div class="clt-label">Reflexo DSR (605/49)</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.nightHours}</div>
        <div class="clt-label">Adicional Noturno (22h-5h)</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.totalDelayHours}</div>
        <div class="clt-label">Total Atrasos</div>
      </div>
      <div class="clt-item">
        <div class="clt-value" style="color: ${cltCalc.absenceMinutes > 0 ? '#dc2626' : '#666'}">${cltCalc.absenceHours}</div>
        <div class="clt-label">Faltas/Ausências</div>
      </div>
      <div class="clt-item">
        <div class="clt-value">${cltCalc.intervalPenaltyHours}</div>
        <div class="clt-label">Intervalo Suprimido<br/>(Art. 71 §4º)</div>
      </div>
      <div class="clt-item">
        <div class="clt-value" style="color: #2563eb; font-size: 13pt;">${cltCalc.totalWorkedHours}</div>
        <div class="clt-label"><strong>TOTAL EFETIVO</strong></div>
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
        <h4>Adicionais e Valores</h4>
        <div class="total-line">
          <span>Reflexo DSR (Lei 605/49):</span>
          <strong>${cltCalc.dsrReflexHours}</strong>
        </div>
        <div class="total-line">
          <span>Adicional Noturno (Art. 73):</span>
          <strong>${cltCalc.nightHours}</strong>
        </div>
        <div class="total-line">
          <span>Intervalo Suprimido (Art. 71):</span>
          <strong>${cltCalc.intervalPenaltyHours}</strong>
        </div>
        <div class="total-line">
          <span>Feriado/Domingo Trab.:</span>
          <strong>${cltCalc.sundayHolidayHours}</strong>
        </div>
        <div class="total-line">
          <span>Atrasos:</span>
          <strong>${cltCalc.totalDelayHours}</strong>
        </div>
        <div class="total-line">
          <span>Faltas/Ausências:</strong>
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

  const generateManagerReport = () => {
    if (!managerReportMonth) {
      alert('Selecione um mês');
      return;
    }

    const [year, month] = managerReportMonth.split('-');
    const monthStart = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const monthEnd = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));

    // Filtrar registros do mês
    const monthRecords = timeRecords.filter(record => {
      const recordDate = parseISO(record.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    // Calcular dados para cada funcionário
    const employeeStats = employees.map(employee => {
      const empRecords = monthRecords.filter(r => r.employee_id === employee.id);
      
      // Verificar data de contratação
      const hireDate = employee.hire_date ? new Date(employee.hire_date + 'T00:00:00') : null;
      
      // Agrupar por dia
      const dayRecords = {};
      empRecords.forEach(record => {
        const recordDate = parseISO(record.timestamp);
        const isAfterHire = !hireDate || recordDate >= hireDate;
        if (!isAfterHire) return;
        
        const day = format(recordDate, 'yyyy-MM-dd');
        if (!dayRecords[day]) dayRecords[day] = [];
        dayRecords[day].push(record);
      });

      // Calcular horas trabalhadas, extras e déficit
      let totalWorkedMinutes = 0;
      let totalOvertimeMinutes = 0;
      let totalDeficitMinutes = 0;
      let daysWorked = 0;

      Object.keys(dayRecords).forEach(day => {
        const records = dayRecords[day].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const entrada1 = records.find(r => r.type === 'entrada');
        const saida1 = records.find(r => r.type === 'pausa');
        const entrada2 = records.find(r => r.type === 'retorno');
        const saida2 = records.find(r => r.type === 'saida');

        if (entrada1 && saida1 && entrada2 && saida2) {
          daysWorked++;
          const toMinutes = (timestamp) => {
            const d = new Date(timestamp);
            return d.getHours() * 60 + d.getMinutes();
          };
          
          const morning = toMinutes(saida1.timestamp) - toMinutes(entrada1.timestamp);
          const afternoon = toMinutes(saida2.timestamp) - toMinutes(entrada2.timestamp);
          const workedMin = Math.max(0, morning) + Math.max(0, afternoon);
          
          totalWorkedMinutes += workedMin;
          
          const expectedMin = 480; // 8h padrão
          const diff = workedMin - expectedMin;
          if (diff > 0) {
            totalOvertimeMinutes += diff;
          } else if (diff < 0) {
            totalDeficitMinutes += Math.abs(diff);
          }
        } else if (entrada1 && saida2) {
          daysWorked++;
          const totalMin = (new Date(saida2.timestamp) - new Date(entrada1.timestamp)) / 60000;
          const breakTime = 60;
          const workedMin = totalMin > 240 ? Math.max(0, totalMin - breakTime) : totalMin;
          totalWorkedMinutes += workedMin;
          
          const expectedMin = 480;
          const diff = workedMin - expectedMin;
          if (diff > 0) {
            totalOvertimeMinutes += diff;
          } else if (diff < 0) {
            totalDeficitMinutes += Math.abs(diff);
          }
        }
      });

      // Calcular faltas
      const employeeShift = shifts.find(s => s.id === employee.shift_id);
      const workDaysMap = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6, 'sunday': 0
      };
      const shiftWorkDays = employeeShift?.work_days?.map(d => workDaysMap[d]) || [1, 2, 3, 4, 5];
      
      let expectedWorkDays = 0;
      const currentDay = new Date(monthStart);
      while (currentDay <= monthEnd) {
        const isAfterHire = !hireDate || currentDay >= hireDate;
        const dayOfWeek = currentDay.getDay();
        const isWorkDay = shiftWorkDays.includes(dayOfWeek);
        
        if (isWorkDay && isAfterHire) {
          expectedWorkDays++;
        }
        
        currentDay.setDate(currentDay.getDate() + 1);
      }

      const absences = expectedWorkDays - daysWorked;

      return {
        name: employee.full_name,
        workedHours: `${Math.floor(totalWorkedMinutes / 60)}:${(totalWorkedMinutes % 60).toString().padStart(2, '0')}`,
        overtimeHours: `${Math.floor(totalOvertimeMinutes / 60)}:${(totalOvertimeMinutes % 60).toString().padStart(2, '0')}`,
        deficitHours: `${Math.floor(totalDeficitMinutes / 60)}:${(totalDeficitMinutes % 60).toString().padStart(2, '0')}`,
        daysWorked,
        absences: Math.max(0, absences),
        totalWorkedMinutes,
        totalOvertimeMinutes,
        totalDeficitMinutes
      };
    });

    // Calcular totais gerais
    const totals = employeeStats.reduce((acc, stat) => ({
      totalWorked: acc.totalWorked + stat.totalWorkedMinutes,
      totalOvertime: acc.totalOvertime + stat.totalOvertimeMinutes,
      totalDeficit: acc.totalDeficit + stat.totalDeficitMinutes,
      totalDaysWorked: acc.totalDaysWorked + stat.daysWorked,
      totalAbsences: acc.totalAbsences + stat.absences
    }), { totalWorked: 0, totalOvertime: 0, totalDeficit: 0, totalDaysWorked: 0, totalAbsences: 0 });

    // Gerar HTML para PDF
    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório Gerencial Mensal - ${format(monthStart, "MMMM 'de' yyyy", { locale: ptBR })}</title>
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
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .period-info {
      font-size: 10pt;
      margin-bottom: 3px;
    }
    .company-section {
      border: 1px solid #000;
      padding: 10px;
      margin-bottom: 15px;
      background: #f9f9f9;
    }
    .company-section h3 {
      font-size: 11pt;
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
    table.report-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 9pt;
    }
    table.report-table th {
      background-color: #333;
      color: white;
      padding: 8px 6px;
      text-align: center;
      border: 1px solid #000;
      font-weight: bold;
      font-size: 9pt;
    }
    table.report-table td {
      padding: 6px;
      text-align: center;
      border: 1px solid #666;
    }
    table.report-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    table.report-table .name-col {
      text-align: left;
      padding-left: 8px;
      font-weight: 500;
    }
    table.report-table .hours-cell {
      font-family: 'Courier New', monospace;
      font-weight: bold;
    }
    table.report-table .total-row {
      background-color: #e8f5e9 !important;
      font-weight: bold;
      font-size: 10pt;
    }
    table.report-table .total-row td {
      border-top: 2px solid #000;
    }
    .summary-section {
      border: 2px solid #000;
      padding: 15px;
      margin-bottom: 15px;
      background: #e3f2fd;
    }
    .summary-section h3 {
      font-size: 12pt;
      margin-bottom: 10px;
      font-weight: bold;
      text-align: center;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    .summary-box {
      text-align: center;
      padding: 10px;
      background: white;
      border: 1px solid #666;
      border-radius: 4px;
    }
    .summary-value {
      font-size: 14pt;
      font-weight: bold;
      color: #1976d2;
      margin-bottom: 4px;
    }
    .summary-label {
      font-size: 8pt;
      color: #666;
    }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>RELATÓRIO GERENCIAL MENSAL</h1>
    <div class="period-info">
      Período: ${format(monthStart, "dd/MM/yyyy")} à ${format(monthEnd, "dd/MM/yyyy")} - 
      Data Emissão: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} - Pág.: 1
    </div>
  </div>

  <div class="company-section">
    <h3>DADOS DA EMPRESA</h3>
    <div class="info-row">
      <strong>Nome Empresa:</strong>
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

  <div class="summary-section">
    <h3>RESUMO CONSOLIDADO DO PERÍODO</h3>
    <div class="summary-grid">
      <div class="summary-box">
        <div class="summary-value">${Math.floor(totals.totalWorked / 60)}:${(totals.totalWorked % 60).toString().padStart(2, '0')}</div>
        <div class="summary-label">Horas Trabalhadas<br/>Total Geral</div>
      </div>
      <div class="summary-box">
        <div class="summary-value" style="color: #2e7d32">${Math.floor(totals.totalOvertime / 60)}:${(totals.totalOvertime % 60).toString().padStart(2, '0')}</div>
        <div class="summary-label">Horas Extras<br/>Total Geral</div>
      </div>
      <div class="summary-box">
        <div class="summary-value" style="color: #d32f2f">${Math.floor(totals.totalDeficit / 60)}:${(totals.totalDeficit % 60).toString().padStart(2, '0')}</div>
        <div class="summary-label">Horas Déficit<br/>Total Geral</div>
      </div>
      <div class="summary-box">
        <div class="summary-value">${totals.totalDaysWorked}</div>
        <div class="summary-label">Dias Trabalhados<br/>Total Geral</div>
      </div>
      <div class="summary-box">
        <div class="summary-value" style="color: #d32f2f">${totals.totalAbsences}</div>
        <div class="summary-label">Faltas<br/>Total Geral</div>
      </div>
    </div>
  </div>

  <table class="report-table">
    <thead>
      <tr>
        <th style="width: 30%">Nome do Funcionário</th>
        <th style="width: 14%">Horas Trabalhadas</th>
        <th style="width: 14%">Horas Extras</th>
        <th style="width: 14%">Horas Déficit</th>
        <th style="width: 14%">Dias Trabalhados</th>
        <th style="width: 14%">Faltas</th>
      </tr>
    </thead>
    <tbody>
      ${employeeStats.map(stat => `
        <tr>
          <td class="name-col">${stat.name}</td>
          <td class="hours-cell">${stat.workedHours}</td>
          <td class="hours-cell" style="color: ${stat.totalOvertimeMinutes > 0 ? '#2e7d32' : '#666'}">${stat.overtimeHours}</td>
          <td class="hours-cell" style="color: ${stat.totalDeficitMinutes > 0 ? '#d32f2f' : '#666'}">${stat.deficitHours}</td>
          <td>${stat.daysWorked}</td>
          <td style="color: ${stat.absences > 0 ? '#d32f2f' : '#666'}">${stat.absences}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td class="name-col">TOTAIS GERAIS</td>
        <td class="hours-cell">${Math.floor(totals.totalWorked / 60)}:${(totals.totalWorked % 60).toString().padStart(2, '0')}</td>
        <td class="hours-cell" style="color: #2e7d32">${Math.floor(totals.totalOvertime / 60)}:${(totals.totalOvertime % 60).toString().padStart(2, '0')}</td>
        <td class="hours-cell" style="color: #d32f2f">${Math.floor(totals.totalDeficit / 60)}:${(totals.totalDeficit % 60).toString().padStart(2, '0')}</td>
        <td>${totals.totalDaysWorked}</td>
        <td style="color: #d32f2f">${totals.totalAbsences}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 30px; text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 10px;">
    Documento gerado automaticamente pelo sistema PontoFlex em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
  </div>

  <div class="no-print" style="position: fixed; bottom: 20px; right: 20px;">
    <button onclick="window.print()" style="background: #6366f1; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
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

      {/* Relatório Gerencial Mensal */}
      <Card className="shadow-xl border-2 border-green-200 dark:border-green-800">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-green-600 to-teal-600 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Relatório Gerencial Mensal</CardTitle>
              <CardDescription>Consolidado de todos os funcionários por mês</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gera um relatório CSV com horas trabalhadas, extras, déficit, dias trabalhados e faltas de todos os funcionários no mês selecionado.
          </p>

          <div className="space-y-2">
            <Label>Mês de Referência</Label>
            <Select value={managerReportMonth} onValueChange={setManagerReportMonth}>
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

          <Button 
            onClick={generateManagerReport}
            disabled={!managerReportMonth}
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            Gerar Relatório Gerencial
          </Button>
        </CardContent>
      </Card>

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