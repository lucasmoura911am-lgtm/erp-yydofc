import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, Trash2, Eye, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function ManageSignedTimeReports() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: "",
    competence: "",
    file: null,
  });

  const queryClient = useQueryClient();

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["signedTimeReports", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.SignedTimeReport.filter({
        company_id: user.company_id,
      }, "-created_date");
    },
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.Employee.filter({
        company_id: user.company_id,
        status: "active",
      });
    },
    enabled: !!user?.company_id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SignedTimeReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["signedTimeReports"]);
      toast.success("Relatório excluído com sucesso");
    },
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.employee_id || !formData.competence || !formData.file) {
      toast.error("Preencha todos os campos");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({
        file: formData.file,
      });

      await base44.entities.SignedTimeReport.create({
        employee_id: formData.employee_id,
        company_id: user.company_id,
        competence: formData.competence,
        file_url,
        status: "pendente",
        uploaded_by: user.email,
      });

      queryClient.invalidateQueries(["signedTimeReports"]);
      toast.success("Relatório enviado com sucesso");
      setOpen(false);
      setFormData({ employee_id: "", competence: "", file: null });
    } catch (error) {
      toast.error("Erro ao enviar relatório");
    } finally {
      setUploading(false);
    }
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find((e) => e.id === employeeId);
    return employee?.full_name || "N/A";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Gestão de Ponto Assinada
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Gerencie os relatórios de ponto para assinatura dos funcionários
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
                <Upload className="w-4 h-4 mr-2" />
                Enviar Relatório
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar Relatório de Ponto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Funcionário</Label>
                  <Select
                    value={formData.employee_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, employee_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Competência (MM/AAAA)</Label>
                  <Input
                    placeholder="Ex: 01/2024"
                    value={formData.competence}
                    onChange={(e) =>
                      setFormData({ ...formData, competence: e.target.value })
                    }
                    pattern="^(0[1-9]|1[0-2])\/[0-9]{4}$"
                  />
                </div>

                <div>
                  <Label>Arquivo do Relatório</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Relatórios Enviados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-gray-500">Carregando...</p>
            ) : reports.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                Nenhum relatório enviado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data de Assinatura</TableHead>
                    <TableHead>Enviado por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {getEmployeeName(report.employee_id)}
                      </TableCell>
                      <TableCell>{report.competence}</TableCell>
                      <TableCell>
                        {report.status === "assinado" ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Assinado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {report.signed_at
                          ? new Date(report.signed_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {report.uploaded_by}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a
                              href={report.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(report.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}