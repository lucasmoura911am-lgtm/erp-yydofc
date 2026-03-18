import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Plus, Trash2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ManagePayslips() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: "",
    competence: "",
    file: null
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  // 🔒 PAYSLIPS COM CONTROLE DE ACESSO
  const { data: payslips = [] } = useQuery({
    queryKey: ['payslips', user?.company_id, user?.email],
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

      // 👑 ADMIN
      if (user.role === "admin") {
        return base44.entities.Payslip.filter(
          { company_id: user.company_id },
          '-created_date'
        );
      }

      // 👤 FUNCIONÁRIO
      if (employeeId) {
        return base44.entities.Payslip.filter(
          {
            company_id: user.company_id,
            employee_id: employeeId
          },
          '-created_date'
        );
      }

      return [];
    },
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () =>
      user?.company_id
        ? base44.entities.Employee.filter({ company_id: user.company_id })
        : [],
    enabled: !!user?.company_id && user?.role === "admin", // 🔒 só admin
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Payslip.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['payslips']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Payslip.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['payslips']);
    },
  });

  const resetForm = () => {
    setFormData({
      employee_id: "",
      competence: "",
      file: null
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.file) {
      alert("Selecione um arquivo");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({
        file: formData.file
      });

      await createMutation.mutateAsync({
        employee_id: formData.employee_id,
        company_id: user.company_id,
        competence: formData.competence,
        file_url: file_url,
        uploaded_by: user.email
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      alert("Erro ao fazer upload do holerite");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir este holerite?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const getEmployeeName = (id) => {
    const employee = employees.find(e => e.id === id);
    return employee ? employee.full_name : "Funcionário";
  };

  const filteredPayslips = payslips.filter(payslip => {
    const competence = payslip.competence.toLowerCase();
    const search = searchTerm.toLowerCase();
    return competence.includes(search);
  });

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            Gestão de Holerites
          </h1>
          <p className="text-gray-500 mt-1">
            Faça upload dos contracheques dos funcionários
          </p>
        </div>

        {isAdmin && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Holerite
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar por competência..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Holerites ({filteredPayslips.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredPayslips.map((payslip) => (
              <div
                key={payslip.id}
                className="flex items-center justify-between p-4 bg-gray-100 rounded-lg"
              >
                <div>
                  <p className="font-semibold">
                    {isAdmin
                      ? getEmployeeName(payslip.employee_id)
                      : "Seu holerite"}
                  </p>

                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">
                      {payslip.competence}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(payslip.file_url, '_blank')}
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Ver
                  </Button>

                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => handleDelete(payslip.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload de Holerite</DialogTitle>
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
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Competência</Label>
                <Input
                  value={formData.competence}
                  onChange={(e) =>
                    setFormData({ ...formData, competence: e.target.value })
                  }
                  placeholder="01/2026"
                />
              </div>

              <div>
                <Label>Arquivo</Label>
                <Input type="file" onChange={handleFileChange} />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Enviando..." : "Enviar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}