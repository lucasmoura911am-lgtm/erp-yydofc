import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText, CheckCircle2, Clock, AlertCircle, Upload,
  Search, Eye, Shield
} from "lucide-react";
import { Link } from "react-router-dom";

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  assinado: { label: "Assinado", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  recusado: { label: "Recusado", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

export default function SmartPayslipsDashboard() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // 🔒 QUERY SEGURA
  const { data: payslips = [] } = useQuery({
    queryKey: ["smart_payslips", user?.company_id, user?.email],
    queryFn: async () => {
      if (!user?.company_id) return [];

      let employeeId = user.employee_id;

      if (!employeeId) {
        const employee = await base44.entities.Employee.filter({
          company_id: user.company_id,
          user_email: user.email
        });

        employeeId = employee?.[0]?.id;
      }

      if (user.role === "admin") {
        return base44.entities.SmartPayslip.filter(
          { company_id: user.company_id },
          "-data_upload"
        );
      }

      if (employeeId) {
        return base44.entities.SmartPayslip.filter(
          {
            company_id: user.company_id,
            employee_id: employeeId
          },
          "-data_upload"
        );
      }

      return [];
    },
    enabled: !!user?.company_id,
  });

  // ✍️ ASSINATURA
  const signMutation = useMutation({
    mutationFn: async (payslip) => {
      const ip = await fetch("https://api.ipify.org?format=json")
        .then(res => res.json())
        .then(data => data.ip);

      return base44.entities.SmartPayslip.update(payslip.id, {
        status_assinado: "assinado",
        data_assinatura: new Date().toISOString(),
        assinatura_nome: user.name || user.email,
        assinatura_ip: ip
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["smart_payslips"]);
    }
  });

  const total = payslips.length;
  const assinados = payslips.filter(p => p.status_assinado === "assinado").length;
  const pendentes = payslips.filter(p => p.status_assinado === "pendente").length;

  const filtered = payslips.filter(p => {
    const matchSearch =
      !search ||
      (p.employee_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.competencia || "").toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      filterStatus === "todos" || p.status_assinado === filterStatus;

    return matchSearch && matchStatus;
  });

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6">

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Holerites Inteligentes</h1>
          <p className="text-gray-500">Assinatura digital de contracheques</p>
        </div>

        {isAdmin && (
          <Link to="/SmartPayslipsUpload">
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload em Lote
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Holerites ({filtered.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {filtered.map(p => {
              const cfg = statusConfig[p.status_assinado] || statusConfig.pendente;
              const Ico = cfg.icon;

              return (
                <div key={p.id} className="flex justify-between p-4 bg-gray-100 rounded-lg">

                  <div>
                    <p className="font-semibold">
                      {isAdmin ? p.employee_name : "Seu holerite"}
                    </p>

                    <div className="flex gap-2 mt-1">
                      <Badge>{p.competencia}</Badge>
                      <Badge className={cfg.color}>
                        <Ico className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>

                    {p.data_assinatura && (
                      <p className="text-xs text-gray-400 mt-1">
                        Assinado em {new Date(p.data_assinatura).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">

                    {p.arquivo_pdf_individual && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(p.arquivo_pdf_individual, "_blank")}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    )}

                    {/* ✍️ BOTÃO ASSINAR */}
                    {!isAdmin && p.status_assinado !== "assinado" && (
                      <Button
                        size="sm"
                        className="bg-green-600 text-white"
                        onClick={() => signMutation.mutate(p)}
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Assinar
                      </Button>
                    )}

                    {p.status_assinado === "assinado" && (
                      <Button size="sm" variant="outline" className="text-green-600">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Assinado
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center text-gray-400 py-10">
                Nenhum holerite encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}