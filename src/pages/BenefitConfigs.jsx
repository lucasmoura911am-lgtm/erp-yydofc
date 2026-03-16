import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, DollarSign, Info, Scissors, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";

// Regras de cesta por estado (0 = zero faltas tolera, 1 = até 1 falta, 2 = até 2 faltas)
const STATE_BASKET_RULES = {
  SP: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  RJ: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  MG: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  RS: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  PR: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  SC: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  BA: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  PE: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  CE: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  GO: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  DF: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  ES: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  MT: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  MS: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  PA: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  AM: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  MA: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  PI: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  AL: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  SE: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  RN: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  PB: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
  AC: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  AP: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  RO: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  RR: { max_absences: 1, description: "Até 1 falta — 2 ou mais faltas cortam a cesta" },
  TO: { max_absences: 0, description: "Zero faltas — qualquer falta corta a cesta" },
};

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
    basket_max_absences: "",
    cutoff_day: "0",
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
      return await base44.entities.BenefitConfig.create({ ...data, company_id: user.company_id });
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
      basket_max_absences: "",
      cutoff_day: "0",
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
      basket_max_absences: config.basket_max_absences ?? "",
      cutoff_day: config.cutoff_day ?? "0",
      active: config.active
    });
    setDialogOpen(true);
  };

  const handleStateChange = (state) => {
    const rule = STATE_BASKET_RULES[state];
    setFormData(prev => ({
      ...prev,
      state,
      basket_max_absences: rule ? String(rule.max_absences) : "0"
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      state: formData.state,
      vr_daily_value: parseFloat(formData.vr_daily_value) || 0,
      va_daily_value: parseFloat(formData.va_daily_value) || 0,
      vt_daily_value: parseFloat(formData.vt_daily_value) || 0,
      basket_monthly_value: parseFloat(formData.basket_monthly_value) || 0,
      basket_max_absences: parseInt(formData.basket_max_absences) || 0,
      cutoff_day: parseInt(formData.cutoff_day) || 0,
      active: formData.active
    };

    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const selectedStateRule = STATE_BASKET_RULES[formData.state];

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
              Configure valores de VR, VA, VT, Cesta, data de corte e regras de assiduidade por Estado
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-gradient-to-r from-purple-600 to-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Nova Configuração
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? "Editar Configuração" : "Nova Configuração"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Estado */}
                <div>
                  <Label>Estado (UF) *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={handleStateChange}
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

                {/* Regra sugerida do estado */}
                {selectedStateRule && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700 text-sm">
                      <strong>Regra sugerida para {formData.state}:</strong> {selectedStateRule.description}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Valores diários */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Valores dos Benefícios
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Vale Refeição (VR) - por dia</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.vr_daily_value}
                        onChange={(e) => setFormData({ ...formData, vr_daily_value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Vale Alimentação (VA) - por dia</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.va_daily_value}
                        onChange={(e) => setFormData({ ...formData, va_daily_value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Vale Transporte (VT) - por dia</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.vt_daily_value}
                        onChange={(e) => setFormData({ ...formData, vt_daily_value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Cesta de Assiduidade - mensal</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.basket_monthly_value}
                        onChange={(e) => setFormData({ ...formData, basket_monthly_value: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Regras da cesta */}
                <div className="border rounded-lg p-4 space-y-4 bg-orange-50 dark:bg-orange-900/10 border-orange-200">
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2">
                    <ShoppingBasket className="w-4 h-4" /> Regra da Cesta de Assiduidade
                  </p>
                  <div>
                    <Label>Máximo de faltas permitidas para receber a cesta</Label>
                    <Select
                      value={String(formData.basket_max_absences)}
                      onValueChange={(v) => setFormData({ ...formData, basket_max_absences: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 faltas — zero tolerância (1 falta já corta)</SelectItem>
                        <SelectItem value="1">1 falta — tolera 1 falta (2 faltas cortam)</SelectItem>
                        <SelectItem value="2">2 faltas — tolera 2 faltas (3 faltas cortam)</SelectItem>
                        <SelectItem value="3">3 faltas — tolera 3 faltas (4 faltas cortam)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-orange-700 mt-1">
                      {formData.basket_max_absences === "0" || formData.basket_max_absences === 0
                        ? "✖ O funcionário perde a cesta se tiver 1 ou mais faltas no período."
                        : `✔ O funcionário recebe a cesta se tiver até ${formData.basket_max_absences} falta(s). A partir de ${parseInt(formData.basket_max_absences) + 1} faltas perde a cesta.`
                      }
                    </p>
                  </div>
                </div>

                {/* Data de corte */}
                <div className="border rounded-lg p-4 space-y-4 bg-purple-50 dark:bg-purple-900/10 border-purple-200">
                  <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                    <Scissors className="w-4 h-4" /> Data de Corte
                  </p>
                  <div>
                    <Label>Dia de corte do mês</Label>
                    <Select
                      value={String(formData.cutoff_day)}
                      onValueChange={(v) => setFormData({ ...formData, cutoff_day: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sem corte — mês cheio (1º ao último dia)</SelectItem>
                        {[5, 10, 15, 20, 25, 28, 30].map(d => (
                          <SelectItem key={d} value={String(d)}>
                            Dia {d} — período do dia {d + 1} do mês anterior até o dia {d} do mês atual
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-purple-700 mt-1">
                      {formData.cutoff_day === "0" || formData.cutoff_day === 0
                        ? "Calcula do 1º ao último dia do mês de competência."
                        : `Calcula do dia ${parseInt(formData.cutoff_day) + 1} do mês anterior até o dia ${formData.cutoff_day} do mês de competência.`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600">
                    {editingConfig ? "Atualizar" : "Criar"} Configuração
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setDialogOpen(false); resetForm(); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info sobre regras por estado */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Info className="w-4 h-4" /> Regras de Cesta por Estado (referência)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <p className="font-semibold text-red-700 mb-1">🔴 Zero faltas (estados rígidos)</p>
                {Object.entries(STATE_BASKET_RULES).filter(([, r]) => r.max_absences === 0).map(([s]) => (
                  <Badge key={s} variant="outline" className="mr-1 mb-1 text-red-700 border-red-300">{s}</Badge>
                ))}
              </div>
              <div>
                <p className="font-semibold text-yellow-700 mb-1">🟡 Até 1 falta (estados flexíveis)</p>
                {Object.entries(STATE_BASKET_RULES).filter(([, r]) => r.max_absences === 1).map(([s]) => (
                  <Badge key={s} variant="outline" className="mr-1 mb-1 text-yellow-700 border-yellow-300">{s}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Configurações Cadastradas por Estado
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
                    <TableHead>VR/dia</TableHead>
                    <TableHead>VA/dia</TableHead>
                    <TableHead>VT/dia</TableHead>
                    <TableHead>Cesta</TableHead>
                    <TableHead>Regra Cesta</TableHead>
                    <TableHead>Corte</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-semibold">{config.state}</TableCell>
                      <TableCell>R$ {(config.vr_daily_value || 0).toFixed(2)}</TableCell>
                      <TableCell>R$ {(config.va_daily_value || 0).toFixed(2)}</TableCell>
                      <TableCell>R$ {(config.vt_daily_value || 0).toFixed(2)}</TableCell>
                      <TableCell>R$ {(config.basket_monthly_value || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          (config.basket_max_absences || 0) === 0
                            ? "border-red-300 text-red-700"
                            : "border-yellow-300 text-yellow-700"
                        }>
                          {(config.basket_max_absences || 0) === 0
                            ? "0 faltas"
                            : `até ${config.basket_max_absences} falta(s)`
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {config.cutoff_day ? `Dia ${config.cutoff_day}` : "Mês cheio"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.active ? "default" : "secondary"}>
                          {config.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Excluir esta configuração?")) deleteMutation.mutate(config.id);
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