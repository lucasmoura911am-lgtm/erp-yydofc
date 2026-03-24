import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Table } from "lucide-react";

const EMPTY = { type: "INSS", year: 2025, min_value: "", max_value: "", rate: "", deduction: 0, active: true, notes: "" };

export default function TaxTablePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("INSS");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: tables = [] } = useQuery({
    queryKey: ["taxTables"],
    queryFn: () => base44.entities.TaxTable.list("-year", 200),
  });

  const save = useMutation({
    mutationFn: (data) => base44.entities.TaxTable.create(data),
    onSuccess: () => { qc.invalidateQueries(["taxTables"]); setOpen(false); setForm(EMPTY); }
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.TaxTable.delete(id),
    onSuccess: () => qc.invalidateQueries(["taxTables"])
  });

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));
  const filtered = tables.filter(t => t.type === tab);
  const years = [...new Set(filtered.map(t => t.year))].sort((a,b) => b-a);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Table className="w-6 h-6" /> Tabelas INSS / IRRF</h1>
          <p className="text-gray-500 text-sm">Tabelas progressivas por ano de vigência</p>
        </div>
        <Button onClick={() => { setForm({...EMPTY, type: tab}); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Nova Faixa</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="INSS">INSS</TabsTrigger><TabsTrigger value="IRRF">IRRF</TabsTrigger></TabsList>

        <TabsContent value={tab} className="space-y-4 mt-4">
          {years.map(year => (
            <Card key={year}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tabela {tab} — {year}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b text-gray-500">
                      <th className="text-left py-1 pr-4">De (R$)</th>
                      <th className="text-left py-1 pr-4">Até (R$)</th>
                      <th className="text-left py-1 pr-4">Alíquota (%)</th>
                      {tab === "IRRF" && <th className="text-left py-1 pr-4">Dedução (R$)</th>}
                      <th className="text-left py-1 pr-4">Obs</th>
                      <th></th>
                    </tr></thead>
                    <tbody>
                      {filtered.filter(t => t.year === year).sort((a,b) => a.min_value - b.min_value).map(row => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-4 font-mono">{row.min_value?.toLocaleString("pt-BR", {style:"currency",currency:"BRL"})}</td>
                          <td className="py-1.5 pr-4 font-mono">{row.max_value ? row.max_value?.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "Sem teto"}</td>
                          <td className="py-1.5 pr-4 font-semibold text-blue-600">{row.rate}%</td>
                          {tab === "IRRF" && <td className="py-1.5 pr-4">{row.deduction?.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>}
                          <td className="py-1.5 pr-4 text-gray-400">{row.notes}</td>
                          <td><Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => del.mutate(row.id)}><Trash2 className="w-3 h-3"/></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
          {years.length === 0 && <div className="text-center py-12 text-gray-400">Nenhuma faixa cadastrada para {tab}</div>}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Faixa — {tab}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={f("type")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="INSS">INSS</SelectItem><SelectItem value="IRRF">IRRF</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Ano</Label><Input type="number" value={form.year} onChange={e => f("year")(+e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor Mínimo (R$)</Label><Input type="number" step="0.01" value={form.min_value} onChange={e => f("min_value")(+e.target.value)} /></div>
              <div><Label>Valor Máximo (R$)</Label><Input type="number" step="0.01" value={form.max_value} onChange={e => f("max_value")(+e.target.value)} placeholder="vazio = sem teto" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Alíquota (%)</Label><Input type="number" step="0.01" value={form.rate} onChange={e => f("rate")(+e.target.value)} /></div>
              <div><Label>Dedução (R$)</Label><Input type="number" step="0.01" value={form.deduction} onChange={e => f("deduction")(+e.target.value)} /></div>
            </div>
            <div><Label>Observação</Label><Input value={form.notes} onChange={e => f("notes")(e.target.value)} /></div>
            <Button className="w-full" onClick={() => save.mutate(form)} disabled={save.isPending}>Salvar Faixa</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}