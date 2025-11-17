import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, CheckCircle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CompanySetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    address: "",
    work_start_time: "08:00",
    work_end_time: "17:00",
    tolerance_minutes: 15,
    break_minutes: 60
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const user = await base44.auth.me();

      // Criar empresa
      const company = await base44.entities.Company.create({
        ...formData,
        status: "active"
      });

      // Atualizar usuário com a empresa
      await base44.auth.updateMe({ 
        company_id: company.id,
        role: 'admin'
      });

      // Criar funcionário para o admin
      await base44.entities.Employee.create({
        user_email: user.email,
        full_name: user.full_name || user.email,
        cpf: "000.000.000-00",
        company_id: company.id,
        status: "active"
      });

      // Redirecionar para o dashboard
      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      setError("Erro ao criar empresa: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-center">
            Configure sua Empresa
          </CardTitle>
          <CardDescription className="text-center text-base">
            Preencha os dados da sua empresa para começar a usar o PontoFlex
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Minha Empresa Ltda"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, cidade - UF"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário de Entrada</Label>
                <Input
                  type="time"
                  value={formData.work_start_time}
                  onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Horário de Saída</Label>
                <Input
                  type="time"
                  value={formData.work_end_time}
                  onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tolerância de Atraso (minutos)</Label>
                <Input
                  type="number"
                  value={formData.tolerance_minutes}
                  onChange={(e) => setFormData({ ...formData, tolerance_minutes: parseInt(e.target.value) })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Pausa/Almoço (minutos)</Label>
                <Input
                  type="number"
                  value={formData.break_minutes}
                  onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) })}
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Criando empresa...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Criar Empresa e Começar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}