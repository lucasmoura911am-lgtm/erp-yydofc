import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const DEFAULTS = {
  weekly_hours: 44, monthly_hours: 220, daily_hours: 8, work_days_per_week: 5,
  dsr_enabled: true, dsr_calculation_type: "AUTOMATICO", dsr_rest_days_per_week: 1,
  night_shift_start: "22:00", night_shift_end: "05:00", night_additional_percentage: 20,
  overtime_50_percentage: 50, overtime_100_percentage: 100,
  tolerance_minutes: 10, break_discount_automatic: true, minimum_break_minutes: 60,
  interjornada_minimum_hours: 11, fgts_percentage: 8, active: true
};

export default function CompanyLaborConfigPage() {
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULTS);
  const [configId, setConfigId] = useState(null);

  const { data: configs = [] } = useQuery({
    queryKey: ["companyLaborConfig", user?.company_id],
    queryFn: () => base44.entities.CompanyLaborConfig.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  useEffect(() => {
    if (configs.length > 0) { setForm(configs[0]); setConfigId(configs[0].id); }
  }, [configs]);

  const save = useMutation({
    mutationFn: (data) => configId
      ? base44.entities.CompanyLaborConfig.update(configId, data)
      : base44.entities.CompanyLaborConfig.create({ ...data, company_id: user.company_id }),
    onSuccess: (res) => {
      if (!configId && res?.id) setConfigId(res.id);
      qc.invalidateQueries(["companyLaborConfig"]);
      toast({ title: "Configuração salva com sucesso!" });
    }
  });

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));
  const fi = (k) => (e) => setForm(p => ({ ...p, [k]: +e.target.value }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" />Configuração Trabalhista</h1>
        <p className="text-gray-500 text-sm">Parâmetros CLT da empresa — base para todos os cálculos</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Jornada de Trabalho</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><Label>Horas Semanais</Label><Input type="number" value={form.weekly_hours} onChange={fi("weekly_hours")} /></div>
            <div><Label>Horas Mensais</Label><Input type="number" value={form.monthly_hours} onChange={fi("monthly_hours")} /></div>
            <div><Label>Horas Diárias</Label><Input type="number" value={form.daily_hours} onChange={fi("daily_hours")} /></div>
            <div><Label>Dias/Semana</Label><Input type="number" value={form.work_days_per_week} onChange={fi("work_days_per_week")} /></div>
            <div><Label>Tolerância (min)</Label><Input type="number" value={form.tolerance_minutes} onChange={fi("tolerance_minutes")} /></div>
            <div><Label>Intervalo Mín. (min)</Label><Input type="number" value={form.minimum_break_minutes} onChange={fi("minimum_break_minutes")} /></div>
            <div><Label>Interjornada Mín. (h)</Label><Input type="number" value={form.interjornada_minimum_hours} onChange={fi("interjornada_minimum_hours")} /></div>
            <div className="flex items-end gap-2 pb-1"><Switch checked={form.break_discount_automatic} onCheckedChange={f("break_discount_automatic")} /><Label className="text-xs">Desconto auto intervalo</Label></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Horas Extras e DSR</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><Label>HE 50% (%)</Label><Input type="number" value={form.overtime_50_percentage} onChange={fi("overtime_50_percentage")} /></div>
            <div><Label>HE 100% (%)</Label><Input type="number" value={form.overtime_100_percentage} onChange={fi("overtime_100_percentage")} /></div>
            <div className="flex items-end gap-2 pb-1"><Switch checked={form.dsr_enabled} onCheckedChange={f("dsr_enabled")} /><Label className="text-xs">DSR Habilitado</Label></div>
            <div><Label>Dias Descanso/sem</Label><Input type="number" value={form.dsr_rest_days_per_week} onChange={fi("dsr_rest_days_per_week")} /></div>
            <div className="col-span-2"><Label>Cálculo DSR</Label>
              <Select value={form.dsr_calculation_type} onValueChange={f("dsr_calculation_type")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="AUTOMATICO">Automático</SelectItem><SelectItem value="MANUAL">Manual</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Adicional Noturno e FGTS</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><Label>Início Noturno</Label><Input value={form.night_shift_start} onChange={e => f("night_shift_start")(e.target.value)} placeholder="22:00" /></div>
            <div><Label>Fim Noturno</Label><Input value={form.night_shift_end} onChange={e => f("night_shift_end")(e.target.value)} placeholder="05:00" /></div>
            <div><Label>Adicional Noturno (%)</Label><Input type="number" value={form.night_additional_percentage} onChange={fi("night_additional_percentage")} /></div>
            <div><Label>FGTS (%)</Label><Input type="number" value={form.fgts_percentage} onChange={fi("fgts_percentage")} /></div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => save.mutate(form)} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" />{save.isPending ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </div>
    </div>
  );
}