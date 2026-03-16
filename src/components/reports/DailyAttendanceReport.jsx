import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DailyAttendanceReport({ companyId, company }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => base44.entities.Employee.filter({ company_id: companyId, status: "active" }),
    enabled: !!companyId,
  });

  const { data: timeRecords = [], isLoading } = useQuery({
    queryKey: ["timeRecords-daily", companyId],
    queryFn: () => base44.entities.TimeRecord.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const dayRecords = timeRecords.filter((r) => r.timestamp?.startsWith(selectedDate));

  const employeeRows = employees.map((emp) => {
    const empRecords = dayRecords
      .filter((r) => r.employee_id === emp.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const entrada = empRecords.find((r) => r.type === "entrada");
    const pausa = empRecords.find((r) => r.type === "pausa");
    const retorno = empRecords.find((r) => r.type === "retorno");
    const saida = empRecords.find((r) => r.type === "saida");
    const bateuPonto = empRecords.length > 0;

    return { ...emp, entrada, pausa, retorno, saida, bateuPonto };
  });

  const presentCount = employeeRows.filter((e) => e.bateuPonto).length;
  const absentCount = employeeRows.filter((e) => !e.bateuPonto).length;

  const fmt = (record) => (record ? format(new Date(record.timestamp), "HH:mm") : "--:--");

  const getStatusText = (emp) => {
    if (!emp.bateuPonto) return { text: "Ausente", color: "#dc2626" };
    if (!emp.saida && emp.entrada) return { text: "Em serviço", color: "#2563eb" };
    if (emp.entrada?.status === "atrasado") return { text: `Atraso ${emp.entrada.delay_minutes}min`, color: "#d97706" };
    return { text: "Presente", color: "#16a34a" };
  };

  const generateReport = () => {
    const dateLabel = format(parseISO(selectedDate), "dd/MM/yyyy", { locale: ptBR });

    const rows = employeeRows.map((emp) => {
      const status = getStatusText(emp);
      const rowBg = !emp.bateuPonto ? "#fff5f5" : "";
      return `
        <tr style="background:${rowBg}">
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:left;font-weight:500">${emp.full_name}</td>
          <td style="padding:6px;border:1px solid #ccc;text-align:center;font-family:monospace">${fmt(emp.entrada)}</td>
          <td style="padding:6px;border:1px solid #ccc;text-align:center;font-family:monospace">${fmt(emp.pausa)}</td>
          <td style="padding:6px;border:1px solid #ccc;text-align:center;font-family:monospace">${fmt(emp.retorno)}</td>
          <td style="padding:6px;border:1px solid #ccc;text-align:center;font-family:monospace">${fmt(emp.saida)}</td>
          <td style="padding:6px;border:1px solid #ccc;text-align:center;color:${status.color};font-weight:bold">${status.text}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Relatório Diário - ${dateLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size:10pt; padding:20px; color:#000; }
      .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:15px; border-bottom:2px solid #000; padding-bottom:10px; }
      .header-center { flex:1; text-align:center; }
      h1 { font-size:15pt; font-weight:bold; margin-bottom:5px; }
      .summary { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:15px 0; }
      .summary-box { text-align:center; padding:10px; background:#f0f4ff; border:1px solid #ccc; border-radius:4px; }
      .summary-val { font-size:20pt; font-weight:bold; color:#1d4ed8; }
      .summary-label { font-size:8pt; color:#555; }
      table { width:100%; border-collapse:collapse; font-size:9pt; }
      th { background:#333; color:#fff; padding:7px 6px; text-align:center; border:1px solid #000; font-size:9pt; }
      th.name { text-align:left; padding-left:8px; }
      tr:nth-child(even) { background:#f9f9f9; }
      .footer { margin-top:20px; text-align:center; font-size:8pt; color:#888; border-top:1px solid #ccc; padding-top:8px; }
      @media print { .no-print { display:none; } }
    </style></head><body>
    <div class="page-header">
      ${company?.logo_url ? `<img src="${company.logo_url}" style="max-width:120px;max-height:50px;object-fit:contain" />` : '<div style="width:120px"></div>'}
      <div class="header-center">
        <h1>RELATÓRIO DIÁRIO DE PRESENÇA</h1>
        <div style="font-size:10pt">Data: ${dateLabel} &nbsp;|&nbsp; Emissão: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
      </div>
      <div style="width:120px"></div>
    </div>

    <div style="border:1px solid #ccc;padding:8px;margin-bottom:12px;background:#f9f9f9;">
      <strong>Empresa:</strong> ${company?.name || "N/A"} &nbsp;&nbsp; <strong>CNPJ:</strong> ${company?.cnpj || "N/A"}
    </div>

    <div class="summary">
      <div class="summary-box"><div class="summary-val">${employeeRows.length}</div><div class="summary-label">Total de Funcionários</div></div>
      <div class="summary-box"><div class="summary-val" style="color:#16a34a">${presentCount}</div><div class="summary-label">Bateram Ponto</div></div>
      <div class="summary-box"><div class="summary-val" style="color:#dc2626">${absentCount}</div><div class="summary-label">Sem Registro</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="name" style="width:30%">Funcionário</th>
          <th style="width:13%">Entrada</th>
          <th style="width:13%">Pausa</th>
          <th style="width:13%">Retorno</th>
          <th style="width:13%">Saída</th>
          <th style="width:18%">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="footer">
      Documento gerado automaticamente pelo sistema PontoFlex em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
    </div>

    <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
      <button onclick="window.print()" style="background:#6366f1;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;">
        🖨️ Imprimir / Salvar PDF
      </button>
    </div>
    </body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
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
            <CardDescription>Todos os funcionários e seus pontos do dia selecionado</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Selecione o Dia</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-48"
            />
          </div>
          <Button onClick={generateReport} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Download className="w-4 h-4 mr-2" />
            Gerar Relatório PDF
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Carregando registros...</div>
        ) : (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{employeeRows.length}</p>
                <p className="text-sm text-gray-500 mt-1">Total Funcionários</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200">
                <p className="text-3xl font-bold text-green-600">{presentCount}</p>
                <p className="text-sm text-green-600 mt-1">Bateram Ponto</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200">
                <p className="text-3xl font-bold text-red-600">{absentCount}</p>
                <p className="text-sm text-red-600 mt-1">Sem Registro</p>
              </div>
            </div>

            {/* Tabela unificada */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="text-left px-4 py-3 font-semibold">Funcionário</th>
                    <th className="text-center px-4 py-3 font-semibold">Entrada</th>
                    <th className="text-center px-4 py-3 font-semibold">Pausa</th>
                    <th className="text-center px-4 py-3 font-semibold">Retorno</th>
                    <th className="text-center px-4 py-3 font-semibold">Saída</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeRows.map((emp, i) => {
                    const status = getStatusText(emp);
                    return (
                      <tr
                        key={emp.id}
                        className={`border-t border-gray-100 dark:border-gray-700 ${
                          !emp.bateuPonto
                            ? "bg-red-50 dark:bg-red-900/10"
                            : i % 2 === 0
                            ? "bg-white dark:bg-gray-900"
                            : "bg-gray-50 dark:bg-gray-800/50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{emp.full_name}</p>
                          {emp.employee_number && (
                            <p className="text-xs text-gray-400">Mat.: {emp.employee_number}</p>
                          )}
                        </td>
                        <td className="text-center px-4 py-3 font-mono font-semibold text-green-600">
                          {fmt(emp.entrada)}
                          {emp.entrada?.status === "atrasado" && (
                            <div className="text-xs text-orange-500 font-sans">+{emp.entrada.delay_minutes}min</div>
                          )}
                        </td>
                        <td className="text-center px-4 py-3 font-mono text-gray-600 dark:text-gray-400">
                          {fmt(emp.pausa)}
                        </td>
                        <td className="text-center px-4 py-3 font-mono text-gray-600 dark:text-gray-400">
                          {fmt(emp.retorno)}
                        </td>
                        <td className="text-center px-4 py-3 font-mono font-semibold text-red-600">
                          {fmt(emp.saida)}
                        </td>
                        <td className="text-center px-4 py-3">
                          <span className="font-semibold text-sm" style={{ color: status.color }}>
                            {status.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {employeeRows.length === 0 && (
              <div className="text-center py-6 text-gray-500">Nenhum funcionário ativo encontrado.</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}