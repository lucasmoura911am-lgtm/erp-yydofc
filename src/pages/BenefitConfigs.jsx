import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function BenefitConfigs() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState({
    state: "",
    vr_daily_value: "",
    va_daily_value: "",
    vt_daily_value: "",
    basket_monthly_value: "",
    active: true
  });

  const queryClient = useQueryClient();

  const states = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["benefitConfigs", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.BenefitConfig.filter({ company_id: user.company_id });
    },
    enabled: !!user?.company_id
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.BenefitConfig.create({
        ...data,
        company_id: user.company_id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["benefitConfigs"]);
      toast.success("Configuração criada com sucesso!");
      setDialogOpen(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.BenefitConfig.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["benefitConfigs"]);
      toast.success("Configuração atualizada!");
      setDialogOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.BenefitConfig.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["benefitConfigs"]);
      toast.success("Configuração excluída!");
    }
  });

  const resetForm = () => {
    setFormData({
      state: "",
      vr_daily_value: "",
      va_daily_value: "",
      vt_daily_value: "",
      basket_monthly_value: "",
      active: true
    });
    setEditingConfig(null);
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      state: config.state,
      vr_daily_value: config.vr_daily_value || "",
      va_daily_value: config.va_daily_value || "",
      vt_daily_value: config.vt_daily_value || "",
      basket_monthly_value: config.basket_monthly_value || "",
      active: config.active
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const data = {
      state: formData.state,
      vr_daily_value: parseFloat(formData.vr_daily_value) || 0,
      va_daily_value: parseFloat(formData.va_daily_value) || 0,
      vt_daily_value: parseFloat(formData.vt_daily_value) || 0,
      basket_monthly_value: parseFloat(formData.basket_monthly_value) || 0,
      active: formData.active
    };

    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!user) return <div className="p-8">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Configuração de Benefícios
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configure valores de VR, VA, VT e Cesta por Estado
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-gradient-to-r from-purple-600 to-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Nova Configuração
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? "Editar Configuração" : "Nova Configuração"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Estado (UF)</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Vale Refeição (VR) - Diário</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.vr_daily_value}
                      onChange={(e) => setFormData({ ...formData, vr_daily_value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Vale Alimentação (VA) - Diário</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.va_daily_value}
                      onChange={(e) => setFormData({ ...formData, va_daily_value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Vale Transporte (VT) - Diário</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.vt_daily_value}
                      onChange={(e) => setFormData({ ...formData, vt_daily_value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Cesta de Assiduidade - Mensal</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.basket_monthly_value}
                      onChange={(e) => setFormData({ ...formData, basket_monthly_value: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingConfig ? "Atualizar" : "Criar"} Configuração
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Configurações por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : configs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma configuração cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>VR (Diário)</TableHead>
                    <TableHead>VA (Diário)</TableHead>
                    <TableHead>VT (Diário)</TableHead>
                    <TableHead>Cesta (Mensal)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-semibold">{config.state}</TableCell>
                      <TableCell>
                        R$ {(config.vr_daily_value || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        R$ {(config.va_daily_value || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        R$ {(config.vt_daily_value || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        R$ {(config.basket_monthly_value || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.active ? "default" : "secondary"}>
                          {config.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(config)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Excluir esta configuração?")) {
                              deleteMutation.mutate(config.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
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