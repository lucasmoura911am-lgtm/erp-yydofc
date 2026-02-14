import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Calendar, Smile } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function MoodReport() {
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

  const generateMoodReport = () => {
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
             recordDate <= monthEnd &&
             record.mood;
    });

    // Agrupar por dia
    const moodByDay = {};
    monthRecords.forEach(record => {
      const day = format(new Date(record.timestamp), 'yyyy-MM-dd');
      if (!moodByDay[day]) {
        moodByDay[day] = [];
      }
      moodByDay[day].push(record);
    });

    // Estatísticas
    const moodCount = {
      muito_feliz: 0,
      feliz: 0,
      neutro: 0,
      triste: 0,
      muito_triste: 0
    };

    monthRecords.forEach(r => {
      if (r.mood) moodCount[r.mood]++;
    });

    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório de Humor - ${employee.full_name}</title>
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
    .company-section {
      border: 1px solid #000;
      padding: 10px;
      margin-bottom: 10px;
      background: #f9f9f9;
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
    .stats-section {
      border: 2px solid #4f46e5;
      padding: 15px;
      margin-bottom: 15px;
      background: #eef2ff;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    .stat-box {
      text-align: center;
      padding: 10px;
      background: white;
      border: 1px solid #666;
      border-radius: 8px;
    }
    .stat-emoji {
      font-size: 32pt;
      margin-bottom: 5px;
    }
    .stat-count {
      font-size: 14pt;
      font-weight: bold;
      color: #4f46e5;
    }
    .stat-label {
      font-size: 8pt;
      color: #666;
    }
    table.mood-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 9pt;
    }
    table.mood-table th {
      background-color: #4f46e5;
      color: white;
      padding: 8px;
      text-align: center;
      border: 1px solid #000;
      font-weight: bold;
    }
    table.mood-table td {
      padding: 6px;
      text-align: center;
      border: 1px solid #666;
    }
    table.mood-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .mood-emoji {
      font-size: 14pt;
    }
    .signature-section {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #000;
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
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>RELATÓRIO DE HUMOR MENSAL</h1>
    <div>
      Período de ${format(monthStart, "dd/MM/yyyy")} à ${format(monthEnd, "dd/MM/yyyy")} - 
      Data Emissão: ${format(new Date(), "dd/MM/yyyy")}
    </div>
  </div>

  <div class="company-section">
    <h3 style="font-size: 10pt; margin-bottom: 8px; border-bottom: 1px solid #666; padding-bottom: 4px;">DADOS DA EMPRESA</h3>
    <div class="info-row">
      <strong>Empresa:</strong>
      <span>${company?.name || 'N/A'}</span>
    </div>
    <div class="info-row">
      <strong>CNPJ:</strong>
      <span>${company?.cnpj || 'N/A'}</span>
    </div>
  </div>

  <div class="company-section">
    <h3 style="font-size: 10pt; margin-bottom: 8px; border-bottom: 1px solid #666; padding-bottom: 4px;">FUNCIONÁRIO</h3>
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
  </div>

  <div class="stats-section">
    <h3 style="font-size: 11pt; font-weight: bold; margin-bottom: 8px;">RESUMO DE HUMOR DO PERÍODO</h3>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-emoji">😄</div>
        <div class="stat-count">${moodCount.muito_feliz}</div>
        <div class="stat-label">Muito Feliz</div>
      </div>
      <div class="stat-box">
        <div class="stat-emoji">😊</div>
        <div class="stat-count">${moodCount.feliz}</div>
        <div class="stat-label">Feliz</div>
      </div>
      <div class="stat-box">
        <div class="stat-emoji">😐</div>
        <div class="stat-count">${moodCount.neutro}</div>
        <div class="stat-label">Neutro</div>
      </div>
      <div class="stat-box">
        <div class="stat-emoji">😔</div>
        <div class="stat-count">${moodCount.triste}</div>
        <div class="stat-label">Triste</div>
      </div>
      <div class="stat-box">
        <div class="stat-emoji">😢</div>
        <div class="stat-count">${moodCount.muito_triste}</div>
        <div class="stat-label">Muito Triste</div>
      </div>
    </div>
  </div>

  <table class="mood-table">
    <thead>
      <tr>
        <th>Data</th>
        <th>Horário</th>
        <th>Tipo</th>
        <th>Humor</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(moodByDay).sort().map(([day, records]) => {
        return records.map(record => `
          <tr>
            <td>${format(new Date(record.timestamp), 'dd/MM/yyyy')}</td>
            <td>${format(new Date(record.timestamp), 'HH:mm')}</td>
            <td>${record.type}</td>
            <td>
              <span class="mood-emoji">${getMoodEmoji(record.mood)}</span>
              ${getMoodLabel(record.mood)}
            </td>
          </tr>
        `).join('');
      }).join('')}
    </tbody>
  </table>

  <div class="signature-section">
    <div style="font-size: 9pt; margin-bottom: 40px; text-align: justify;">
      Confirmo que os registros de humor acima refletem meu estado emocional durante os registros de ponto no período indicado.
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
    <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Relatório de Humor</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Acompanhe o humor dos funcionários durante os registros de ponto
        </p>
      </div>

      <Card className="shadow-xl border-2 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
              <Smile className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Relatório Mensal de Humor</CardTitle>
              <CardDescription>Documento para acompanhamento do bem-estar emocional</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gera um relatório completo com todos os registros de humor do funcionário no período selecionado, incluindo estatísticas e espaço para assinatura.
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
            onClick={generateMoodReport}
            disabled={!selectedEmployee || !selectedMonth}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            <FileText className="w-5 h-5 mr-2" />
            Gerar Relatório de Humor
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}