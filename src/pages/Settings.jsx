import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Building2, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    address: "",
    work_start_time: "08:00",
    work_end_time: "17:00",
    tolerance_minutes: 15,
    break_minutes: 60,
    logo_url: ""
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Company.filter({ id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  useEffect(() => {
    if (companies.length > 0) {
      const company = companies[0];
      setFormData({
        name: company.name || "",
        cnpj: company.cnpj || "",
        address: company.address || "",
        work_start_time: company.work_start_time || "08:00",
        work_end_time: company.work_end_time || "17:00",
        tolerance_minutes: company.tolerance_minutes || 15,
        break_minutes: company.break_minutes || 60,
        logo_url: company.logo_url || ""
      });
    }
  }, [companies]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.update(user.company_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      alert("Erro ao fazer upload do logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Configure os parâmetros da empresa
        </p>
      </div>

      {success && (
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-200">
            Configurações salvas com sucesso!
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Dados da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Empresa *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <div className="flex items-center gap-4">
                {formData.logo_url && (
                  <img 
                    src={formData.logo_url} 
                    alt="Logo da empresa" 
                    className="w-24 h-24 object-contain border rounded-lg"
                  />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                />
              </div>
              {uploading && (
                <p className="text-xs text-gray-500">Fazendo upload...</p>
              )}
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Configurações de Horário
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário Padrão de Entrada</Label>
                  <Input
                    type="time"
                    value={formData.work_start_time}
                    onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário Padrão de Saída</Label>
                  <Input
                    type="time"
                    value={formData.work_end_time}
                    onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tolerância (minutos)</Label>
                  <Input
                    type="number"
                    value={formData.tolerance_minutes}
                    onChange={(e) => setFormData({ ...formData, tolerance_minutes: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-gray-500">
                    Minutos de tolerância para atrasos
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Intervalo (minutos)</Label>
                  <Input
                    type="number"
                    value={formData.break_minutes}
                    onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-gray-500">
                    Tempo de pausa/almoço padrão
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}