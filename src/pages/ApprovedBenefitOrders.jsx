import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Download, PackageCheck, Printer, XCircle } from "lucide-react";
import { format, subMonths } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS = {
  aprovado: "bg-blue-100 text-blue-700 border-blue-200",
  emitido: "bg-green-100 text-green-700 border-green-200",
  cancelado: "bg-red-100 text-red-700 border-red-200"
};

const STATUS_LABELS = {
  aprovado: "Aprovado — Aguardando Emissão",
  emitido: "Emitido",
  cancelado: "Cancelado"
};

export default function ApprovedBenefitOrders() {
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "MM/yyyy"));
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["approvedBenefitOrders", user?.company_id, selectedMonth],
    queryFn: () => base44.entities.ApprovedBenefitOrder.filter({
      company_id: user.company_id,
      competence: selectedMonth
    }),
    enabled: !!user?.company_id
  });

  const issueMutation = useMutation({
    mutationFn: (orderId) => base44.entities.ApprovedBenefitOrder.update(orderId, {
      status: "emitido",
      issued_by: user.email,
      issued_at: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(["approvedBenefitOrders"]);
      toast.success("Benefício marcado como emitido!");
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId) => base44.entities.ApprovedBenefitOrder.update(orderId, {
      status: "cancelado"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(["approvedBenefitOrders"]);
      toast.success("Pedido cancelado.");
    }
  });

  const issueAllMutation = useMutation({
    mutationFn: async () => {
      const pending = orders.filter(o => o.status === "aprovado");
      await Promise.all(pending.map(o => base44.entities.ApprovedBenefitOrder.update(o.id, {
        status: "emitido",
        issued_by: user.email,
        issued_at: new Date().toISOString()
      })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["approvedBenefitOrders"]);
      toast.success("Todos os benefícios marcados como emitidos!");
    }
  });

  const exportCSV = () => {
    if (orders.length === 0) return;
    const rows = orders.map(o => {
      const emp = employees.find(e => e.id === o.employee_id);
      return [
        emp?.full_name || "",
        o.state,
        o.competence,
        o.worked_days,
        o.absences,
        (o.vr_total_value || 0).toFixed(2),
        (o.va_total_value || 0).toFixed(2),
        (o.vt_total_value || 0).toFixed(2),
        (o.basket_value || 0).toFixed(2),
        (o.total_benefits || 0).toFixed(2),
        STATUS_LABELS[o.status],
        o.approved_by || "",
        o.issued_by || ""
      ].join(",");
    });
    const header = "Nome,Estado,Competência,Dias Trab.,Faltas,VR,VA,VT,Cesta,Total,Status,Aprovado por,Emitido por";
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-beneficios-${selectedMonth.replace("/", "-")}.csv`;
    a.click();
  };

  const getEmp = (id) => employees.find(e => e.id === id);
  const pendingCount = orders.filter(o => o.status === "aprovado").length;
  const totalApproved = orders.reduce((s, o) => s + (o.total_benefits || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <PackageCheck className="w-8 h-8 text-green-600" />
              Pedidos de Benefícios Aprovados
            </h1>
            <p className="text-gray-500 mt-1">Gerencie a emissão dos benefícios aprovados pelo RH</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = subMonths(new Date(), i);
                  const value = format(date, "MM/yyyy");
                  return <SelectItem key={value} value={value}>{value}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            {orders.length > 0 && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-gray-500">Total de Pedidos</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{orders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-gray-500">Aguardando Emissão</p>
              <p className="text-3xl font-bold text-blue-600">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-gray-500">Total Aprovado</p>
              <p className="text-3xl font-bold text-green-600">R$ {totalApproved.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-3">
              <span>Pedidos de {selectedMonth}</span>
              {pendingCount > 0 && (
                <Button
                  onClick={() => issueAllMutation.mutate()}
                  disabled={issueAllMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {issueAllMutation.isPending ? "Emitindo..." : `Emitir Todos (${pendingCount})`}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <PackageCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum pedido aprovado para {selectedMonth}</p>
                <p className="text-sm mt-1">Aprove benefícios na tela de Gestão de Benefícios</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>VR</TableHead>
                      <TableHead>VA</TableHead>
                      <TableHead>VT</TableHead>
                      <TableHead>Cesta</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aprovado por</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => {
                      const emp = getEmp(order.employee_id);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{emp?.full_name || "N/A"}</TableCell>
                          <TableCell><Badge variant="outline">{order.state}</Badge></TableCell>
                          <TableCell>{order.worked_days}</TableCell>
                          <TableCell>R$ {(order.vr_total_value || 0).toFixed(2)}</TableCell>
                          <TableCell>R$ {(order.va_total_value || 0).toFixed(2)}</TableCell>
                          <TableCell>R$ {(order.vt_total_value || 0).toFixed(2)}</TableCell>
                          <TableCell>R$ {(order.basket_value || 0).toFixed(2)}</TableCell>
                          <TableCell className="font-bold text-green-700">
                            R$ {(order.total_benefits || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[order.status]}>
                              {STATUS_LABELS[order.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{order.approved_by}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {order.status === "aprovado" && (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                                    onClick={() => issueMutation.mutate(order.id)}
                                    disabled={issueMutation.isPending}
                                  >
                                    <Printer className="w-3 h-3 mr-1" />
                                    Emitir
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-red-600 hover:bg-red-50"
                                    onClick={() => cancelMutation.mutate(order.id)}
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                              {order.status === "emitido" && (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {order.issued_at ? format(new Date(order.issued_at), "dd/MM HH:mm") : "Emitido"}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}