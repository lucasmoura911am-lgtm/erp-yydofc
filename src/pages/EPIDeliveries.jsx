import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, PackageCheck, Search, Pen, FileDown, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addMonths } from "date-fns";

const STATUS_COLORS = {
  rascunho: "bg-gray-100 text-gray-600",
  gerado: "bg-blue-100 text-blue-700",
  assinado: "bg-green-100 text-green-700",
};

export default function EPIDeliveries() {
  const [user, setUser] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [search, setSearch] = useState("");

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observations, setObservations] = useState("");
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ epi_id: "", quantity: 1, validity_date: "" });

  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }),
    enabled: !!user?.company_id,
  });

  const { data: epis = [] } = useQuery({
    queryKey: ["epis", user?.company_id],
    queryFn: () => base44.entities.EPI.filter({ company_id: user.company_id, active: true }),
    enabled: !!user?.company_id,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["epi-deliveries", user?.company_id],
    queryFn: () => base44.entities.EPIDelivery.filter({ company_id: user.company_id }, "-created_date"),
    enabled: !!user?.company_id,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["epi-delivery-items"],
    queryFn: () => base44.entities.EPIDeliveryItem.list(),
    enabled: !!user?.company_id,
  });

  const { data: company } = useQuery({
    queryKey: ["company", user?.company_id],
    queryFn: async () => {
      const list = await base44.entities.Company.filter({ id: user.company_id });
      return list[0] || null;
    },
    enabled: !!user?.company_id,
  });

  const createDeliveryMut = useMutation({
    mutationFn: async ({ deliveryData, itemsData }) => {
      const delivery = await base44.entities.EPIDelivery.create(deliveryData);
      for (const item of itemsData) {
        await base44.entities.EPIDeliveryItem.create({ ...item, delivery_id: delivery.id });
      }
      return delivery;
    },
    onSuccess: () => {
      qc.invalidateQueries(["epi-deliveries"]);
      qc.invalidateQueries(["epi-delivery-items"]);
      closeDialog();
      toast({ title: "Entrega registrada com sucesso!" });
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.EPIDelivery.update(id, { status }),
    onSuccess: () => qc.invalidateQueries(["epi-deliveries"]),
  });

  const uploadSignedMut = useMutation({
    mutationFn: async ({ id, file }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return base44.entities.EPIDelivery.update(id, { signed_file_url: file_url, status: "assinado" });
    },
    onSuccess: () => {
      qc.invalidateQueries(["epi-deliveries"]);
      toast({ title: "Arquivo assinado enviado!" });
    },
  });

  const closeDialog = () => {
    setShowDialog(false);
    setSelectedEmployee("");
    setDeliveryDate(format(new Date(), "yyyy-MM-dd"));
    setObservations("");
    setItems([]);
    setNewItem({ epi_id: "", quantity: 1, validity_date: "" });
  };

  const addItem = () => {
    if (!newItem.epi_id) return toast({ title: "Selecione um EPI", variant: "destructive" });
    const epi = epis.find(e => e.id === newItem.epi_id);
    if (!epi) return;

    // Auto-calculate validity date from EPI validity_months
    let validity_date = newItem.validity_date;
    if (!validity_date && epi.validity_months) {
      validity_date = format(addMonths(new Date(deliveryDate), epi.validity_months), "yyyy-MM-dd");
    }

    setItems([...items, {
      epi_id: epi.id,
      epi_name: epi.name,
      ca_number: epi.ca_number || "",
      quantity: newItem.quantity,
      validity_date,
    }]);
    setNewItem({ epi_id: "", quantity: 1, validity_date: "" });
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const handleSave = () => {
    if (!selectedEmployee) return toast({ title: "Selecione o funcionário", variant: "destructive" });
    if (items.length === 0) return toast({ title: "Adicione ao menos um EPI", variant: "destructive" });

    createDeliveryMut.mutate({
      deliveryData: {
        employee_id: selectedEmployee,
        company_id: user.company_id,
        delivery_date: deliveryDate,
        responsible_user: user.email,
        observations,
        status: "rascunho",
        ip_address: "registrado via sistema",
      },
      itemsData: items,
    });
  };

  const generatePDF = (delivery) => {
    const emp = employees.find(e => e.id === delivery.employee_id);
    const delivItems = allItems.filter(i => i.delivery_id === delivery.id);

    const rows = delivItems.map(item => `
      <tr>
        <td style="border:1px solid #ccc;padding:8px">${item.epi_name || "—"}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.quantity}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.ca_number || "—"}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.validity_date ? format(new Date(item.validity_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Ficha de EPI - ${emp?.full_name}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; padding: 30px; }
      h1 { font-size: 14pt; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
      h2 { font-size: 11pt; text-align: center; color: #444; margin-bottom: 20px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
      .info-item label { font-size: 8pt; color: #666; display: block; text-transform: uppercase; }
      .info-item span { font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
      th { background: #f0f0f0; border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 9pt; text-transform: uppercase; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
      .sig-box { text-align: center; }
      .sig-line { border-top: 1px solid #000; margin: 60px 20px 8px; }
      .footer { margin-top: 30px; font-size: 8pt; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
      .legal { font-size: 8pt; color: #444; margin-bottom: 20px; padding: 8px; border: 1px solid #eee; background: #fafafa; }
      @media print { .no-print { display: none; } }
    </style></head><body>
    ${company?.logo_url ? `<div style="text-align:center;margin-bottom:16px"><img src="${company.logo_url}" style="max-height:60px;max-width:200px"></div>` : ""}
    <h1>${company?.name || "EMPRESA"}</h1>
    <h2>Ficha de Controle e Entrega de EPI</h2>

    <div class="info-grid">
      <div class="info-item"><label>Funcionário</label><span>${emp?.full_name || "—"}</span></div>
      <div class="info-item"><label>CPF</label><span>${emp?.cpf || "—"}</span></div>
      <div class="info-item"><label>Cargo / Função</label><span>${emp?.job_function || emp?.category || "—"}</span></div>
      <div class="info-item"><label>Data da Entrega</label><span>${delivery.delivery_date ? format(new Date(delivery.delivery_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</span></div>
      <div class="info-item"><label>Responsável</label><span>${delivery.responsible_user || "—"}</span></div>
      <div class="info-item"><label>Matrícula</label><span>${emp?.employee_number || "—"}</span></div>
    </div>

    <table>
      <thead><tr>
        <th>Equipamento de Proteção Individual</th>
        <th style="width:80px;text-align:center">Qtd.</th>
        <th style="width:100px;text-align:center">Nº CA</th>
        <th style="width:100px;text-align:center">Validade</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="legal">
      <strong>DECLARAÇÃO:</strong> Declaro ter recebido os Equipamentos de Proteção Individual (EPIs) listados acima, 
      em perfeito estado de conservação, e me comprometo a utilizá-los adequadamente, conservá-los e comunicar 
      qualquer defeito ou dano ao responsável, conforme determina o Art. 158 da CLT e a NR-6.
      ${delivery.observations ? `<br><br><strong>Observações:</strong> ${delivery.observations}` : ""}
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <p><strong>${emp?.full_name || "Funcionário"}</strong></p>
        <p style="font-size:8pt;color:#666">Assinatura do Funcionário</p>
        <p style="font-size:8pt;color:#666">Data: ____/____/________</p>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <p><strong>Responsável pela Entrega</strong></p>
        <p style="font-size:8pt;color:#666">Assinatura / Carimbo</p>
        <p style="font-size:8pt;color:#666">Data: ____/____/________</p>
      </div>
    </div>

    <div class="footer">
      Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} • Sistema PontoFlex • ${company?.cnpj ? `CNPJ: ${company.cnpj}` : ""}
    </div>

    <div class="no-print" style="position:fixed;bottom:20px;right:20px">
      <button onclick="window.print()" style="background:#f97316;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.2)">
        🖨️ Imprimir / Salvar PDF
      </button>
    </div>
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    updateStatusMut.mutate({ id: delivery.id, status: "gerado" });
  };

  const filtered = deliveries.filter(d => {
    const emp = employees.find(e => e.id === d.employee_id);
    return emp?.full_name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
            <PackageCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Entrega de EPIs</h1>
            <p className="text-gray-500 text-sm">Registre e gerencie entregas de equipamentos</p>
          </div>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-gradient-to-r from-orange-500 to-red-500">
          <Plus className="w-4 h-4 mr-2" /> Nova Entrega
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input placeholder="Buscar por funcionário..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Data da Entrega</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Nenhuma entrega registrada</TableCell></TableRow>
              )}
              {filtered.map(d => {
                const emp = employees.find(e => e.id === d.employee_id);
                const dItems = allItems.filter(i => i.delivery_id === d.id);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{emp?.full_name || "—"}</TableCell>
                    <TableCell>{d.delivery_date ? format(new Date(d.delivery_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{d.responsible_user || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{dItems.length} {dItems.length === 1 ? "item" : "itens"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[d.status] || "bg-gray-100 text-gray-600"}>
                        {d.status === "rascunho" ? "Rascunho" : d.status === "gerado" ? "Ficha Gerada" : "Assinado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => generatePDF(d)} title="Gerar Ficha PDF">
                          <FileDown className="w-4 h-4" />
                        </Button>
                        {d.status !== "assinado" && (
                          <label title="Enviar arquivo assinado">
                            <Button size="sm" variant="outline" asChild>
                              <span className="cursor-pointer">
                                <Pen className="w-4 h-4" />
                              </span>
                            </Button>
                            <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={e => {
                              if (e.target.files[0]) uploadSignedMut.mutate({ id: d.id, file: e.target.files[0] });
                            }} />
                          </label>
                        )}
                        {d.signed_file_url && (
                          <Button size="sm" variant="outline" onClick={() => window.open(d.signed_file_url, "_blank")} title="Ver arquivo assinado">
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Delivery Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><PackageCheck className="w-5 h-5" /> Nova Entrega de EPI</DialogTitle></DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Funcionário *</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da Entrega *</Label>
                <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
            </div>

            {/* Add EPI item */}
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 space-y-3">
              <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">Adicionar EPI</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>EPI</Label>
                  <Select value={newItem.epi_id} onValueChange={v => setNewItem({ ...newItem, epi_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar EPI..." /></SelectTrigger>
                    <SelectContent>
                      {epis.map(e => <SelectItem key={e.id} value={e.id}>{e.name}{e.ca_number ? ` (CA: ${e.ca_number})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min={1} value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Validade (opcional)</Label>
                  <Input type="date" value={newItem.validity_date} onChange={e => setNewItem({ ...newItem, validity_date: e.target.value })} />
                </div>
                <div className="flex items-end">
                  <Button onClick={addItem} className="w-full bg-orange-500 hover:bg-orange-600">
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <div>
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">EPIs a entregar</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>EPI</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>CA</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.epi_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.ca_number || "—"}</TableCell>
                        <TableCell>{item.validity_date ? format(new Date(item.validity_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeItem(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Observações sobre a entrega..." className="h-20" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createDeliveryMut.isPending} className="bg-gradient-to-r from-orange-500 to-red-500">
              {createDeliveryMut.isPending ? "Salvando..." : "Registrar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}