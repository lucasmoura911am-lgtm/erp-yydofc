import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  User, Calendar, DollarSign, PackageCheck, MapPin, ArrowRightLeft, Search,
  Clock, FileText, TrendingUp, HardHat, Download, Plus, Edit3
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
        <Icon className="w-4 h-4 text-purple-600" />
      </div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
      {count !== undefined && (
        <Badge variant="secondary" className="ml-auto">{count} registros</Badge>
      )}
    </div>
  );
}

const CHANGE_LABELS = {
  admissao: "Admissão", promocao: "Promoção", alteracao_salario: "Alteração Salarial",
  alteracao_cargo: "Alteração de Cargo", transferencia: "Transferência", desligamento: "Desligamento"
};
const CHANGE_COLORS = {
  admissao: "bg-green-100 text-green-700", promocao: "bg-purple-100 text-purple-700",
  alteracao_salario: "bg-blue-100 text-blue-700", alteracao_cargo: "bg-yellow-100 text-yellow-700",
  transferencia: "bg-orange-100 text-orange-700", desligamento: "bg-red-100 text-red-700"
};

const EMPTY_HISTORY = { change_date: format(new Date(), "yyyy-MM-dd"), change_type: "alteracao_salario", old_position: "", new_position: "", old_salary: "", new_salary: "", reason: "", notes: "" };

export default function EmployeeLifeReport() {
  const [user, setUser] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [historyDialog, setHistoryDialog] = useState(false);
  const [historyForm, setHistoryForm] = useState(EMPTY_HISTORY);
  const [editingHistory, setEditingHistory] = useState(null);
  const reportRef = useRef(null);
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", user?.company_id],
    queryFn: () => base44.entities.Position.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.company_id],
    queryFn: () => base44.entities.Client.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["payslips", selectedEmployeeId],
    queryFn: () => base44.entities.Payslip.filter({ employee_id: selectedEmployeeId }),
    enabled: !!selectedEmployeeId
  });

  const { data: approvedBenefits = [] } = useQuery({
    queryKey: ["approvedBenefits", selectedEmployeeId],
    queryFn: () => base44.entities.ApprovedBenefitOrder.filter({ employee_id: selectedEmployeeId }),
    enabled: !!selectedEmployeeId
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocationsEmp", selectedEmployeeId, user?.company_id],
    queryFn: () => base44.entities.Allocation.filter({ employee_id: selectedEmployeeId, company_id: user.company_id }),
    enabled: !!selectedEmployeeId && !!user?.company_id
  });

  const { data: coverages = [] } = useQuery({
    queryKey: ["coveragesEmp", selectedEmployeeId, user?.company_id],
    queryFn: () => base44.entities.PostCoverage.filter({ backup_employee_id: selectedEmployeeId, company_id: user.company_id }),
    enabled: !!selectedEmployeeId && !!user?.company_id
  });

  const { data: smartPayslips = [] } = useQuery({
    queryKey: ["smartPayslips", selectedEmployeeId],
    queryFn: () => base44.entities.SmartPayslip.filter({ employee_id: selectedEmployeeId }),
    enabled: !!selectedEmployeeId
  });

  const { data: epiDeliveries = [] } = useQuery({
    queryKey: ["epiDeliveries", selectedEmployeeId],
    queryFn: () => base44.entities.EPIDelivery.filter({ employee_id: selectedEmployeeId }),
    enabled: !!selectedEmployeeId
  });

  const { data: epiItems = [] } = useQuery({
    queryKey: ["epiItems", selectedEmployeeId],
    queryFn: () => base44.entities.EPIDeliveryItem.filter({ employee_id: selectedEmployeeId }),
    enabled: !!selectedEmployeeId
  });

  const { data: salaryHistory = [] } = useQuery({
    queryKey: ["salaryHistory", selectedEmployeeId],
    queryFn: () => base44.entities.EmployeeSalaryHistory.filter({ employee_id: selectedEmployeeId }),
    enabled: !!selectedEmployeeId
  });

  const saveHistory = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data, company_id: user.company_id, employee_id: selectedEmployeeId,
        registered_by: user.email,
        old_salary: data.old_salary ? parseFloat(data.old_salary) : undefined,
        new_salary: data.new_salary ? parseFloat(data.new_salary) : undefined,
      };
      return editingHistory
        ? base44.entities.EmployeeSalaryHistory.update(editingHistory.id, payload)
        : base44.entities.EmployeeSalaryHistory.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries(["salaryHistory", selectedEmployeeId]);
      setHistoryDialog(false); setEditingHistory(null); setHistoryForm(EMPTY_HISTORY);
    }
  });

  const deleteHistory = useMutation({
    mutationFn: (id) => base44.entities.EmployeeSalaryHistory.delete(id),
    onSuccess: () => qc.invalidateQueries(["salaryHistory", selectedEmployeeId])
  });

  const emp = employees.find(e => e.id === selectedEmployeeId);
  const position = positions.find(p => p.id === emp?.position_id);

  const filteredEmployees = employees.filter(e =>
    e.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cpf?.includes(searchTerm) || e.employee_number?.includes(searchTerm)
  );

  const getClientName = (id) => clients.find(c => c.id === id)?.name || "–";

  const allPayments = [
    ...payslips.map(p => ({ type: "Holerite", competence: p.competence, date: p.created_date, status: "uploaded" })),
    ...smartPayslips.map(p => ({ type: "Holerite Digital", competence: p.competencia, date: p.data_upload, status: p.status_assinado, valor: p.valor_liquido }))
  ].sort((a, b) => (b.competence || "").localeCompare(a.competence || ""));

  const sortedAllocations = [...allocations].sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
  const sortedCoverages = [...coverages].sort((a, b) => (b.start_datetime || "").localeCompare(a.start_datetime || ""));
  const sortedBenefits = [...approvedBenefits].sort((a, b) => (b.competence || "").localeCompare(a.competence || ""));
  const sortedHistory = [...salaryHistory].sort((a, b) => (b.change_date || "").localeCompare(a.change_date || ""));
  const sortedEpiDeliveries = [...epiDeliveries].sort((a, b) => (b.delivery_date || "").localeCompare(a.delivery_date || ""));

  const totalBenefits = sortedBenefits.reduce((s, b) => s + (b.total_benefits || 0), 0);

  const REASON_LABELS = {
    falta: "Falta", ferias: "Férias", atestado: "Atestado",
    folga: "Folga", emergencia: "Emergência", outro: "Outro"
  };

  const handleExportPDF = async () => {
    if (!emp) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(109, 40, 217);
    doc.rect(0, 0, pageW, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("Relatório de Vida do Funcionário", pageW / 2, 16, { align: "center" });
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW / 2, 28, { align: "center" });
    y = 45;

    const addSection = (title) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(243, 232, 255);
      doc.rect(10, y - 4, pageW - 20, 9, "F");
      doc.setTextColor(109, 40, 217);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text(title, 14, y + 2);
      y += 10;
      doc.setTextColor(30, 30, 30);
      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
    };

    const addRow = (label, value) => {
      if (!value) return;
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont(undefined, "bold");
      doc.text(label + ":", 14, y);
      doc.setFont(undefined, "normal");
      doc.text(String(value), 60, y);
      y += 6;
    };

    // Employee info
    addSection("Dados do Funcionário");
    addRow("Nome", emp.full_name);
    addRow("CPF", emp.cpf);
    addRow("Matrícula", emp.employee_number);
    addRow("Cargo", position?.name || emp.job_function);
    addRow("Admissão", emp.hire_date ? format(new Date(emp.hire_date), "dd/MM/yyyy") : "");
    addRow("Salário Atual", emp.salary ? `R$ ${Number(emp.salary).toFixed(2)}` : "");
    addRow("Status", emp.status === "active" ? "Ativo" : emp.status === "on_leave" ? "Afastado" : "Inativo");
    addRow("E-mail", emp.user_email);
    y += 4;

    // Salary history
    if (sortedHistory.length > 0) {
      addSection("Histórico de Cargo e Salário");
      sortedHistory.forEach(h => {
        if (y > 265) { doc.addPage(); y = 20; }
        const label = CHANGE_LABELS[h.change_type] || h.change_type;
        doc.setFont(undefined, "bold");
        doc.text(`${h.change_date} — ${label}`, 14, y);
        y += 5;
        doc.setFont(undefined, "normal");
        if (h.old_position || h.new_position) doc.text(`Cargo: ${h.old_position || "–"} → ${h.new_position || "–"}`, 20, y), y += 5;
        if (h.old_salary || h.new_salary) doc.text(`Salário: R$ ${h.old_salary || 0} → R$ ${h.new_salary || 0}`, 20, y), y += 5;
        if (h.reason) doc.text(`Motivo: ${h.reason}`, 20, y), y += 5;
        y += 2;
      });
    }

    // Payments
    if (allPayments.length > 0) {
      addSection("Pagamentos / Holerites");
      allPayments.slice(0, 24).forEach(p => {
        if (y > 265) { doc.addPage(); y = 20; }
        doc.text(`${p.competence} — ${p.type}${p.valor ? " | R$ " + Number(p.valor).toFixed(2) : ""}`, 14, y);
        y += 5;
      });
    }

    // Benefits
    if (sortedBenefits.length > 0) {
      addSection("Benefícios Aprovados");
      sortedBenefits.slice(0, 24).forEach(b => {
        if (y > 265) { doc.addPage(); y = 20; }
        doc.text(`${b.competence} — Total: R$ ${(b.total_benefits || 0).toFixed(2)} | VR: ${(b.vr_total_value || 0).toFixed(2)} | VA: ${(b.va_total_value || 0).toFixed(2)}`, 14, y);
        y += 5;
      });
    }

    // EPI
    if (sortedEpiDeliveries.length > 0) {
      addSection("Fichas de EPI");
      sortedEpiDeliveries.forEach(ep => {
        if (y > 265) { doc.addPage(); y = 20; }
        doc.text(`${ep.delivery_date} — Status: ${ep.status} | ${ep.observations || ""}`, 14, y);
        y += 5;
      });
    }

    // Allocations
    if (sortedAllocations.length > 0) {
      addSection("Histórico de Lotações");
      sortedAllocations.forEach(a => {
        if (y > 265) { doc.addPage(); y = 20; }
        doc.text(`${a.post_name} — ${getClientName(a.client_id)} (${a.start_date || "–"} → ${a.end_date || "atual"})`, 14, y);
        y += 5;
      });
    }

    doc.save(`vida-funcionario-${emp.full_name.replace(/\s+/g, "-")}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6" ref={reportRef}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              Relatório de Vida do Funcionário
            </h1>
            <p className="text-gray-500 mt-1">Histórico completo: cargo/salário, pagamentos, EPI, benefícios, lotações e coberturas</p>
          </div>
          {emp && (
            <Button onClick={handleExportPDF} className="bg-gradient-to-r from-purple-600 to-blue-600 gap-2">
              <Download className="w-4 h-4" /> Exportar PDF
            </Button>
          )}
        </div>

        {/* Employee Selector */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Buscar funcionário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Selecione um funcionário..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name} {e.employee_number ? `(${e.employee_number})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!selectedEmployeeId && (
          <div className="text-center py-20 text-gray-400">
            <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Selecione um funcionário para ver seu histórico completo</p>
          </div>
        )}

        {emp && (
          <>
            {/* Employee Card */}
            <Card className="border-purple-200 dark:border-purple-800">
              <CardContent className="pt-5">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={emp.photo_url} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-2xl">{emp.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{emp.full_name}</h2>
                      <p className="text-gray-500 text-sm">{position?.name || emp.job_function || "Sem cargo"}</p>
                      <Badge className={emp.status === "active" ? "bg-green-100 text-green-700 mt-2" : "bg-gray-100 text-gray-600 mt-2"}>
                        {emp.status === "active" ? "Ativo" : emp.status === "on_leave" ? "Afastado" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <InfoRow label="CPF" value={emp.cpf} />
                      <InfoRow label="Matrícula" value={emp.employee_number} />
                      <InfoRow label="Admissão" value={emp.hire_date ? format(new Date(emp.hire_date), "dd/MM/yyyy") : null} />
                    </div>
                    <div className="space-y-1">
                      <InfoRow label="Salário Atual" value={emp.salary ? `R$ ${Number(emp.salary).toFixed(2)}` : null} />
                      <InfoRow label="UF" value={emp.address_state} />
                      <InfoRow label="Email" value={emp.user_email} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {[
                    { label: "Holerites", value: allPayments.length, icon: FileText, color: "text-blue-600" },
                    { label: "Benefícios", value: sortedBenefits.length, icon: PackageCheck, color: "text-green-600" },
                    { label: "Lotações", value: sortedAllocations.length, icon: MapPin, color: "text-orange-600" },
                    { label: "Coberturas", value: sortedCoverages.length, icon: ArrowRightLeft, color: "text-purple-600" },
                    { label: "Fichas EPI", value: sortedEpiDeliveries.length, icon: HardHat, color: "text-yellow-600" },
                    { label: "Histórico Cargo", value: sortedHistory.length, icon: Edit3, color: "text-red-600" },
                  ].map(stat => (
                    <div key={stat.label} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="history">
              <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
                <TabsTrigger value="history"><Edit3 className="w-3.5 h-3.5 mr-1" />Cargo/Salário</TabsTrigger>
                <TabsTrigger value="payments"><DollarSign className="w-3.5 h-3.5 mr-1" />Pagamentos</TabsTrigger>
                <TabsTrigger value="benefits"><PackageCheck className="w-3.5 h-3.5 mr-1" />Benefícios</TabsTrigger>
                <TabsTrigger value="epi"><HardHat className="w-3.5 h-3.5 mr-1" />EPI</TabsTrigger>
                <TabsTrigger value="allocations"><MapPin className="w-3.5 h-3.5 mr-1" />Lotações</TabsTrigger>
                <TabsTrigger value="coverages"><ArrowRightLeft className="w-3.5 h-3.5 mr-1" />Coberturas</TabsTrigger>
              </TabsList>

              {/* Salary/Position History */}
              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <SectionHeader icon={Edit3} title="Histórico de Cargo e Salário" count={sortedHistory.length} />
                      <Button size="sm" onClick={() => { setEditingHistory(null); setHistoryForm(EMPTY_HISTORY); setHistoryDialog(true); }} className="bg-purple-600 text-white gap-1">
                        <Plus className="w-4 h-4" />Registrar Alteração
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {sortedHistory.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">Nenhuma alteração registrada ainda</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                        <div className="space-y-4">
                          {sortedHistory.map(h => (
                            <div key={h.id} className="relative pl-12">
                              <div className="absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 border-purple-500 bg-white dark:bg-gray-900" />
                              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className={CHANGE_COLORS[h.change_type] || "bg-gray-100 text-gray-700"}>
                                      {CHANGE_LABELS[h.change_type] || h.change_type}
                                    </Badge>
                                    <span className="text-xs text-gray-500">{h.change_date ? format(new Date(h.change_date), "dd/MM/yyyy") : "–"}</span>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingHistory(h); setHistoryForm({ ...h, old_salary: String(h.old_salary || ""), new_salary: String(h.new_salary || "") }); setHistoryDialog(true); }}>
                                    <Edit3 className="w-3 h-3" />
                                  </Button>
                                </div>
                                {(h.old_position || h.new_position) && (
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">Cargo:</span> {h.old_position || "–"} → <span className="font-bold text-purple-600">{h.new_position || "–"}</span>
                                  </p>
                                )}
                                {(h.old_salary || h.new_salary) && (
                                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                    <span className="font-medium">Salário:</span> R$ {Number(h.old_salary || 0).toFixed(2)} → <span className="font-bold text-green-600">R$ {Number(h.new_salary || 0).toFixed(2)}</span>
                                    {h.old_salary && h.new_salary && (
                                      <span className={`ml-2 text-xs font-bold ${h.new_salary > h.old_salary ? "text-green-600" : "text-red-500"}`}>
                                        ({h.new_salary > h.old_salary ? "+" : ""}{(((h.new_salary - h.old_salary) / h.old_salary) * 100).toFixed(1)}%)
                                      </span>
                                    )}
                                  </p>
                                )}
                                {h.reason && <p className="text-xs text-gray-500 mt-1">Motivo: {h.reason}</p>}
                                {h.notes && <p className="text-xs text-gray-400 italic mt-1">"{h.notes}"</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Payments */}
              <TabsContent value="payments">
                <Card>
                  <CardHeader><SectionHeader icon={DollarSign} title="Lista de Pagamentos (Holerites)" count={allPayments.length} /></CardHeader>
                  <CardContent>
                    {allPayments.length === 0 ? <p className="text-center py-8 text-gray-400">Nenhum holerite encontrado</p> : (
                      <div className="space-y-2">
                        {allPayments.map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><FileText className="w-4 h-4 text-blue-600" /></div>
                              <div>
                                <p className="font-medium text-sm">{p.type}</p>
                                <p className="text-xs text-gray-500">Competência: {p.competence}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {p.valor && <p className="font-semibold text-green-600">R$ {Number(p.valor).toFixed(2)}</p>}
                              <Badge className={p.status === "assinado" ? "bg-green-100 text-green-700" : p.status === "recusado" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}>
                                {p.status === "assinado" ? "Assinado" : p.status === "recusado" ? "Recusado" : p.status === "uploaded" ? "Enviado" : "Pendente"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Benefits */}
              <TabsContent value="benefits">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <SectionHeader icon={PackageCheck} title="Benefícios Aprovados" count={sortedBenefits.length} />
                      {sortedBenefits.length > 0 && <p className="text-lg font-bold text-green-600">Total: R$ {totalBenefits.toFixed(2)}</p>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {sortedBenefits.length === 0 ? <p className="text-center py-8 text-gray-400">Nenhum benefício aprovado</p> : (
                      <div className="space-y-2">
                        {sortedBenefits.map(b => (
                          <div key={b.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{b.competence}</Badge>
                                <Badge variant="outline">{b.state}</Badge>
                                <Badge className={b.status === "emitido" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>{b.status}</Badge>
                              </div>
                              <span className="font-bold text-green-600">R$ {(b.total_benefits || 0).toFixed(2)}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs text-gray-500">
                              <span>VR: R$ {(b.vr_total_value || 0).toFixed(2)}</span>
                              <span>VA: R$ {(b.va_total_value || 0).toFixed(2)}</span>
                              <span>VT: R$ {(b.vt_total_value || 0).toFixed(2)}</span>
                              <span>Cesta: R$ {(b.basket_value || 0).toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{b.worked_days} dias trabalhados · {b.absences} falta(s)</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* EPI */}
              <TabsContent value="epi">
                <Card>
                  <CardHeader><SectionHeader icon={HardHat} title="Fichas de EPI" count={sortedEpiDeliveries.length} /></CardHeader>
                  <CardContent>
                    {sortedEpiDeliveries.length === 0 ? <p className="text-center py-8 text-gray-400">Nenhuma ficha de EPI registrada</p> : (
                      <div className="space-y-3">
                        {sortedEpiDeliveries.map(ep => {
                          const items = epiItems.filter(i => i.epi_delivery_id === ep.id);
                          return (
                            <div key={ep.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                              <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <HardHat className="w-4 h-4 text-yellow-600" />
                                  <span className="font-medium text-sm">Entrega em {ep.delivery_date ? format(new Date(ep.delivery_date), "dd/MM/yyyy") : "–"}</span>
                                </div>
                                <Badge className={ep.status === "assinado" ? "bg-green-100 text-green-700" : ep.status === "gerado" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}>
                                  {ep.status}
                                </Badge>
                              </div>
                              {items.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {items.map((item, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">{item.epi_name} (x{item.quantity})</Badge>
                                  ))}
                                </div>
                              )}
                              {ep.observations && <p className="text-xs text-gray-400 mt-2 italic">"{ep.observations}"</p>}
                              {ep.signed_file_url && <a href={ep.signed_file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-500 hover:underline mt-1 block">Ver ficha assinada</a>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Allocations */}
              <TabsContent value="allocations">
                <Card>
                  <CardHeader><SectionHeader icon={MapPin} title="Histórico de Lotações" count={sortedAllocations.length} /></CardHeader>
                  <CardContent>
                    {sortedAllocations.length === 0 ? <p className="text-center py-8 text-gray-400">Nenhuma lotação encontrada</p> : (
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                        <div className="space-y-4">
                          {sortedAllocations.map(alloc => (
                            <div key={alloc.id} className="relative pl-12">
                              <div className="absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 border-purple-500 bg-white dark:bg-gray-900" />
                              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                  <div>
                                    <p className="font-semibold">{alloc.post_name}</p>
                                    <p className="text-sm text-gray-500">{getClientName(alloc.client_id)}</p>
                                  </div>
                                  <Badge className={alloc.status === "ativo" ? "bg-green-100 text-green-700" : alloc.status === "encerrado" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}>{alloc.status}</Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Início: {alloc.start_date ? format(new Date(alloc.start_date), "dd/MM/yyyy") : "–"}</span>
                                  {alloc.end_date && <span>→ Fim: {format(new Date(alloc.end_date), "dd/MM/yyyy")}</span>}
                                  {alloc.salary_at_post && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />R$ {Number(alloc.salary_at_post).toFixed(2)}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Coverages */}
              <TabsContent value="coverages">
                <Card>
                  <CardHeader><SectionHeader icon={ArrowRightLeft} title="Coberturas de Posto Realizadas" count={sortedCoverages.length} /></CardHeader>
                  <CardContent>
                    {sortedCoverages.length === 0 ? <p className="text-center py-8 text-gray-400">Nenhuma cobertura registrada</p> : (
                      <div className="space-y-2">
                        {sortedCoverages.map(cov => (
                          <div key={cov.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between flex-wrap gap-2">
                              <div>
                                <p className="font-medium text-sm flex items-center gap-1.5">
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-orange-500" />
                                  Cobertura em: {getClientName(cov.client_id)}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">Motivo: {REASON_LABELS[cov.reason] || cov.reason}</p>
                              </div>
                              <Badge className={cov.status === "em_andamento" ? "bg-blue-100 text-blue-700" : cov.status === "concluida" ? "bg-green-100 text-green-700" : cov.status === "cancelada" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>{cov.status}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{cov.start_datetime ? format(new Date(cov.start_datetime), "dd/MM/yyyy HH:mm") : "–"}</span>
                              {cov.end_datetime && <span>→ {format(new Date(cov.end_datetime), "dd/MM/yyyy HH:mm")}</span>}
                            </div>
                            {cov.notes && <p className="text-xs text-gray-400 mt-1 italic">"{cov.notes}"</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingHistory ? "Editar Registro" : "Registrar Alteração de Cargo/Salário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de Alteração *</Label>
                <Select value={historyForm.change_type} onValueChange={v => setHistoryForm(f => ({ ...f, change_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Data da Alteração *</Label>
                <Input type="date" value={historyForm.change_date} onChange={e => setHistoryForm(f => ({ ...f, change_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cargo Anterior</Label>
                <Input value={historyForm.old_position} onChange={e => setHistoryForm(f => ({ ...f, old_position: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Novo Cargo</Label>
                <Input value={historyForm.new_position} onChange={e => setHistoryForm(f => ({ ...f, new_position: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Salário Anterior (R$)</Label>
                <Input type="number" step="0.01" value={historyForm.old_salary} onChange={e => setHistoryForm(f => ({ ...f, old_salary: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Novo Salário (R$)</Label>
                <Input type="number" step="0.01" value={historyForm.new_salary} onChange={e => setHistoryForm(f => ({ ...f, new_salary: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input value={historyForm.reason} onChange={e => setHistoryForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Input value={historyForm.notes} onChange={e => setHistoryForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveHistory.mutate(historyForm)} disabled={saveHistory.isPending} className="bg-gradient-to-r from-purple-600 to-blue-600">
              {saveHistory.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}