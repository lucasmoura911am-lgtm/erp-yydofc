import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Calendar, DollarSign, PackageCheck, MapPin, ArrowRightLeft, Search,
  Briefcase, Clock, CheckCircle2, FileText, TrendingUp
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

export default function EmployeeLifeReport() {
  const [user, setUser] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

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

  // Data for selected employee
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

  const emp = employees.find(e => e.id === selectedEmployeeId);
  const position = positions.find(p => p.id === emp?.position_id);

  const filteredEmployees = employees.filter(e =>
    e.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cpf?.includes(searchTerm) ||
    e.employee_number?.includes(searchTerm)
  );

  const getClientName = (id) => clients.find(c => c.id === id)?.name || "–";

  const allPayments = [
    ...payslips.map(p => ({ type: "Holerite", competence: p.competence, date: p.created_date, status: "uploaded" })),
    ...smartPayslips.map(p => ({ type: "Holerite Digital", competence: p.competencia, date: p.data_upload, status: p.status_assinado, valor: p.valor_liquido }))
  ].sort((a, b) => (b.competence || "").localeCompare(a.competence || ""));

  const sortedAllocations = [...allocations].sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
  const sortedCoverages = [...coverages].sort((a, b) => (b.start_datetime || "").localeCompare(a.start_datetime || ""));
  const sortedBenefits = [...approvedBenefits].sort((a, b) => (b.competence || "").localeCompare(a.competence || ""));

  const totalBenefits = sortedBenefits.reduce((s, b) => s + (b.total_benefits || 0), 0);

  const REASON_LABELS = {
    falta: "Falta", ferias: "Férias", atestado: "Atestado",
    folga: "Folga", emergencia: "Emergência", outro: "Outro"
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            Relatório de Vida do Funcionário
          </h1>
          <p className="text-gray-500 mt-1">Histórico completo: pagamentos, benefícios, lotações e coberturas</p>
        </div>

        {/* Employee Selector */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar funcionário..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Selecione um funcionário..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} {e.employee_number ? `(${e.employee_number})` : ""}
                    </SelectItem>
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
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-2xl">
                      {emp.full_name?.charAt(0)}
                    </AvatarFallback>
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
                      <InfoRow label="Salário" value={emp.salary ? `R$ ${Number(emp.salary).toFixed(2)}` : null} />
                      <InfoRow label="UF" value={emp.address_state} />
                      <InfoRow label="Email" value={emp.user_email} />
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {[
                    { label: "Holerites", value: allPayments.length, icon: FileText, color: "text-blue-600" },
                    { label: "Benefícios Aprovados", value: sortedBenefits.length, icon: PackageCheck, color: "text-green-600" },
                    { label: "Lotações", value: sortedAllocations.length, icon: MapPin, color: "text-orange-600" },
                    { label: "Coberturas feitas", value: sortedCoverages.length, icon: ArrowRightLeft, color: "text-purple-600" }
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

            {/* Tabs */}
            <Tabs defaultValue="payments">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="payments" className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Pagamentos
                </TabsTrigger>
                <TabsTrigger value="benefits" className="flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4" /> Benefícios
                </TabsTrigger>
                <TabsTrigger value="allocations" className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Lotações
                </TabsTrigger>
                <TabsTrigger value="coverages" className="flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4" /> Coberturas
                </TabsTrigger>
              </TabsList>

              {/* Payments */}
              <TabsContent value="payments">
                <Card>
                  <CardHeader>
                    <SectionHeader icon={DollarSign} title="Lista de Pagamentos (Holerites)" count={allPayments.length} />
                  </CardHeader>
                  <CardContent>
                    {allPayments.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">Nenhum holerite encontrado</p>
                    ) : (
                      <div className="space-y-2">
                        {allPayments.map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{p.type}</p>
                                <p className="text-xs text-gray-500">Competência: {p.competence}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {p.valor && <p className="font-semibold text-green-600">R$ {Number(p.valor).toFixed(2)}</p>}
                              <Badge className={
                                p.status === "assinado" ? "bg-green-100 text-green-700" :
                                p.status === "recusado" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-600"
                              }>
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
                      {sortedBenefits.length > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total acumulado</p>
                          <p className="text-lg font-bold text-green-600">R$ {totalBenefits.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {sortedBenefits.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">Nenhum benefício aprovado encontrado</p>
                    ) : (
                      <div className="space-y-2">
                        {sortedBenefits.map(b => (
                          <div key={b.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{b.competence}</Badge>
                                <Badge variant="outline">{b.state}</Badge>
                                <Badge className={b.status === "emitido" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                                  {b.status === "emitido" ? "Emitido" : "Aprovado"}
                                </Badge>
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

              {/* Allocations */}
              <TabsContent value="allocations">
                <Card>
                  <CardHeader>
                    <SectionHeader icon={MapPin} title="Histórico de Lotações" count={sortedAllocations.length} />
                  </CardHeader>
                  <CardContent>
                    {sortedAllocations.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">Nenhuma lotação encontrada</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                        <div className="space-y-4">
                          {sortedAllocations.map((alloc, i) => (
                            <div key={alloc.id} className="relative pl-12">
                              <div className="absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 border-purple-500 bg-white dark:bg-gray-900" />
                              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                  <div>
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">{alloc.post_name}</p>
                                    <p className="text-sm text-gray-500">{getClientName(alloc.client_id)}</p>
                                    {alloc.post_location && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{alloc.post_location}</p>}
                                  </div>
                                  <Badge className={
                                    alloc.status === "ativo" ? "bg-green-100 text-green-700" :
                                    alloc.status === "encerrado" ? "bg-gray-100 text-gray-600" :
                                    "bg-yellow-100 text-yellow-700"
                                  }>
                                    {alloc.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Início: {alloc.start_date ? format(new Date(alloc.start_date), "dd/MM/yyyy") : "–"}
                                  </span>
                                  {alloc.end_date && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Fim: {format(new Date(alloc.end_date), "dd/MM/yyyy")}
                                    </span>
                                  )}
                                  {alloc.salary_at_post && (
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="w-3 h-3" />
                                      R$ {Number(alloc.salary_at_post).toFixed(2)}
                                    </span>
                                  )}
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
                  <CardHeader>
                    <SectionHeader icon={ArrowRightLeft} title="Coberturas de Posto Realizadas" count={sortedCoverages.length} />
                  </CardHeader>
                  <CardContent>
                    {sortedCoverages.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">Nenhuma cobertura registrada</p>
                    ) : (
                      <div className="space-y-2">
                        {sortedCoverages.map(cov => (
                          <div key={cov.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between flex-wrap gap-2">
                              <div>
                                <p className="font-medium text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-orange-500" />
                                  Cobertura em: {getClientName(cov.client_id)}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">Motivo: {REASON_LABELS[cov.reason] || cov.reason}</p>
                              </div>
                              <Badge className={
                                cov.status === "em_andamento" ? "bg-blue-100 text-blue-700" :
                                cov.status === "concluida" ? "bg-green-100 text-green-700" :
                                cov.status === "cancelada" ? "bg-red-100 text-red-700" :
                                "bg-yellow-100 text-yellow-700"
                              }>
                                {cov.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {cov.start_datetime ? format(new Date(cov.start_datetime), "dd/MM/yyyy HH:mm") : "–"}
                              </span>
                              {cov.end_datetime && (
                                <span>→ {format(new Date(cov.end_datetime), "dd/MM/yyyy HH:mm")}</span>
                              )}
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
    </div>
  );
}