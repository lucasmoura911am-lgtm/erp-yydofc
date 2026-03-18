import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Pencil, Trash2, Check, ShoppingCart, Download, FileText, ChevronRight, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const STATUS_FLOW = ["solicitado", "autorizado", "comprado", "entregue", "cancelado"];

const STATUS_CONFIG = {
  solicitado: { label: "Solicitado", color: "bg-yellow-100 text-yellow-700", next: "autorizado", nextLabel: "Autorizar" },
  autorizado: { label: "Autorizado", color: "bg-blue-100 text-blue-700", next: "comprado", nextLabel: "Marcar como Comprado" },
  comprado: { label: "Comprado", color: "bg-purple-100 text-purple-700", next: "entregue", nextLabel: "Confirmar Entrega" },
  entregue: { label: "Entregue ✅", color: "bg-green-100 text-green-700", next: null },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700", next: null },
};

const EMPTY_FORM = {
  date: today, requester_name: "", requester_email: "", cost_center_id: "",
  client_name: "", client_id: "", supplier_name: "", items: [], notes: "", status: "solicitado", attachment_url: ""
};

export default function PurchaseOrders() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [confirmDelivery, setConfirmDelivery] = useState(null); // order being delivered
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm(f => ({ ...f, requester_email: u.email, requester_name: u.full_name }));
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => {
        if (emps[0]?.company_id) setCid(emps[0].company_id);
      });
    });
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["po_list", cid, user?.email],
    queryFn: () => cid
      ? base44.entities.PurchaseOrder.filter({ company_id: cid })
      : base44.entities.PurchaseOrder.filter({ requester_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["po_cc", cid],
    queryFn: () => base44.entities.CostCenter.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["po_supp", cid],
    queryFn: () => base44.entities.Supplier.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["po_clients", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: contractStocks = [] } = useQuery({
    queryKey: ["po_cstocks", cid],
    queryFn: () => base44.entities.ContractStock.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const generateNumber = () => {
    const d = format(new Date(), "yyyyMMdd");
    return `PC-${d}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  };

  const calcTotal = (items) => items.reduce((s, i) => s + (i.total || 0), 0);

  const save = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: cid || "unknown", total_value: calcTotal(data.items) };
      if (!payload.number) payload.number = generateNumber();
      return editing
        ? base44.entities.PurchaseOrder.update(editing.id, payload)
        : base44.entities.PurchaseOrder.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po_list"] });
      setOpen(false); setEditing(null);
      setForm({ ...EMPTY_FORM, requester_email: user?.email, requester_name: user?.full_name });
      toast.success("Pedido salvo!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.PurchaseOrder.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["po_list"] }); toast.success("Removido!"); },
  });

  // Advance order status in flow
  const advanceStatus = useMutation({
    mutationFn: async ({ order, toStatus }) => {
      const updates = {
        status: toStatus,
        ...(toStatus === "autorizado" ? { approved_by_email: user.email, approved_by_name: user.full_name, approved_at: new Date().toISOString() } : {}),
      };
      await base44.entities.PurchaseOrder.update(order.id, updates);

      // On delivery: auto-add items to ContractStock + create ContractExpense
      if (toStatus === "entregue" && order.client_name) {
        for (const item of (order.items || [])) {
          if (!item.description) continue;
          const match = contractStocks.find(s =>
            s.client_name === order.client_name &&
            s.product?.toLowerCase() === item.description?.toLowerCase()
          );
          if (match) {
            await base44.entities.ContractStock.update(match.id, {
              quantity_on_site: (match.quantity_on_site || 0) + (item.quantity || 0),
              last_replenishment_date: today,
            });
          } else {
            await base44.entities.ContractStock.create({
              company_id: cid,
              client_name: order.client_name,
              client_id: order.client_id || "",
              product: item.description,
              unit: item.unit || "UN",
              quantity_on_site: item.quantity || 0,
              min_quantity: 0,
              daily_consumption: 0,
              last_replenishment_date: today,
            });
          }
        }

        // Create ContractExpense for total order value
        if ((order.total_value || 0) > 0) {
          const [yyyy, mm] = today.split("-");
          await base44.entities.ContractExpense.create({
            company_id: cid,
            client_id: order.client_id || "",
            client_name: order.client_name,
            category: "compra",
            description: `Pedido de Compra ${order.number || ""} — ${(order.items || []).map(i => i.description).filter(Boolean).join(", ")}`,
            amount: order.total_value || 0,
            date: today,
            competence: `${mm}/${yyyy}`,
            reference_id: order.id,
            reference_type: "purchase_order",
            created_by: user?.email || "",
            notes: order.notes || ""
          });
        }
      }
    },
    onSuccess: (_, { toStatus }) => {
      qc.invalidateQueries({ queryKey: ["po_list"] });
      qc.invalidateQueries({ queryKey: ["cstock_list"] });
      if (toStatus === "entregue") toast.success("✅ Entrega confirmada! Estoque do contrato atualizado.");
      else toast.success("Status atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: "", quantity: 1, unit: "UN", unit_price: 0, total: 0 }] }));
  const updateItem = (idx, field, val) => setForm(f => {
    const items = [...f.items];
    items[idx] = { ...items[idx], [field]: val };
    if (field === "quantity" || field === "unit_price") items[idx].total = (items[idx].quantity || 0) * (items[idx].unit_price || 0);
    return { ...f, items };
  });
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm(f => ({ ...f, attachment_url: file_url })); }
    catch { toast.error("Erro ao enviar arquivo"); }
    setUploading(false);
  };

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_FORM, requester_email: user?.email, requester_name: user?.full_name }); setOpen(true); };
  const openEdit = (o) => { setEditing(o); setForm({ ...o }); setOpen(true); };

  const isAdmin = user?.role === "admin";
  const filtered = orders.filter(o => filterStatus === "all" || o.status === filterStatus);

  const counts = STATUS_FLOW.reduce((acc, s) => { acc[s] = orders.filter(o => o.status === s).length; return acc; }, {});

  const exportCSV = () => {
    const rows = [["Número","Data","Solicitante","Fornecedor","Cliente","Valor Total","Status"]];
    filtered.forEach(o => rows.push([o.number||"",o.date||"",o.requester_name||"",o.supplier_name||"",o.client_name||"",o.total_value||0,STATUS_CONFIG[o.status]?.label||o.status]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "pedidos_compra.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🛒 Pedidos de Compra</h1>
          <p className="text-sm text-gray-400">Fluxo: Solicitado → Autorizado → Comprado → Entregue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4" />CSV</Button>
          <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4" />Novo PC</Button>
        </div>
      </div>

      {/* Flow pipeline visual */}
      <div className="grid grid-cols-4 gap-2">
        {["solicitado","autorizado","comprado","entregue"].map((s, i) => (
          <div key={s} className={`rounded-2xl p-3 text-center cursor-pointer transition-all ${filterStatus===s?"ring-2 ring-violet-500 bg-white shadow-md":"bg-white dark:bg-gray-900 shadow-sm hover:shadow"}`} onClick={()=>setFilterStatus(filterStatus===s?"all":s)}>
            <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{counts[s]||0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{STATUS_CONFIG[s].label}</p>
            {i < 3 && <div className="hidden md:flex justify-center mt-1"><ChevronRight className="w-3 h-3 text-gray-300"/></div>}
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[["all","Todos"],["solicitado","Solicitados"],["autorizado","Autorizados"],["comprado","Comprados"],["entregue","Entregues"],["cancelado","Cancelados"]].map(([v,l])=>(
          <Button key={v} size="sm" variant={filterStatus===v?"default":"outline"} onClick={()=>setFilterStatus(v)} className={filterStatus===v?"bg-violet-600 text-white":""}>{l}</Button>
        ))}
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <p className="text-4xl mb-3">🛒</p><p className="text-gray-500">Nenhum pedido encontrado</p>
              <Button onClick={openNew} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1" />Criar pedido</Button>
            </div>
          ) : filtered.map(o => {
            const cfg = STATUS_CONFIG[o.status];
            return (
              <Card key={o.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{o.number || "—"}</span>
                        <Badge className={cfg?.color}>{cfg?.label}</Badge>
                        <span className="text-xs text-gray-400">{o.date}</span>
                        {o.status === "entregue" && <Badge className="bg-emerald-100 text-emerald-700 text-xs">📦 Estoque atualizado</Badge>}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {o.requester_name && <span>Solicitante: <b>{o.requester_name}</b></span>}
                        {o.supplier_name && <span>Fornecedor: <b>{o.supplier_name}</b></span>}
                        {o.client_name && <span>Cliente: <b>{o.client_name}</b></span>}
                        {o.approved_by_name && <span>Autorizado por: <b>{o.approved_by_name}</b></span>}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-base font-bold text-green-600">R$ {(o.total_value||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
                        <span className="text-xs text-gray-400">{(o.items||[]).length} item(s)</span>
                        {o.attachment_url && <a href={o.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:underline flex items-center gap-1"><FileText className="w-3 h-3"/>Anexo</a>}
                      </div>
                      {/* Items preview */}
                      {(o.items||[]).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {o.items.slice(0,4).map((item,i) => (
                            <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-gray-600 dark:text-gray-300">{item.description} ({item.quantity} {item.unit})</span>
                          ))}
                          {o.items.length > 4 && <span className="text-xs text-gray-400">+{o.items.length-4} mais</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0 items-end">
                      {isAdmin && cfg?.next && (
                        <Button size="sm" className={`text-xs h-8 ${o.status==="solicitado"?"bg-blue-500 hover:bg-blue-600":o.status==="autorizado"?"bg-purple-500 hover:bg-purple-600":"bg-green-500 hover:bg-green-600"} text-white`}
                          onClick={()=> o.status==="comprado" ? setConfirmDelivery(o) : advanceStatus.mutate({order:o,toStatus:cfg.next})}
                          disabled={advanceStatus.isPending}>
                          <ArrowRight className="w-3 h-3 mr-1"/>{cfg.nextLabel}
                        </Button>
                      )}
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(o)}><Pencil className="w-3.5 h-3.5"/></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={()=>del.mutate(o.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {confirmDelivery && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2"><Package className="w-5 h-5 text-green-500"/>Confirmar Entrega</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ao confirmar, os itens abaixo serão automaticamente adicionados ao estoque do cliente <b>{confirmDelivery.client_name}</b>:
            </p>
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {(confirmDelivery.items||[]).map((item,i)=>(
                <div key={i} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                  <Package className="w-4 h-4 text-green-500 flex-shrink-0"/>
                  <span className="text-sm text-gray-800 flex-1">{item.description}</span>
                  <span className="text-sm font-bold text-green-600">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={()=>setConfirmDelivery(null)}>Cancelar</Button>
              <Button className="bg-green-500 hover:bg-green-600 text-white" disabled={advanceStatus.isPending}
                onClick={()=>{ advanceStatus.mutate({order:confirmDelivery,toStatus:"entregue"}); setConfirmDelivery(null); }}>
                ✅ {advanceStatus.isPending?"Processando...":"Confirmar e atualizar estoque"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">{editing?"Editar Pedido":"Novo Pedido de Compra"}</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpen(false);setEditing(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data *</label><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                  <Select value={form.status} onValueChange={v=>setForm(f=>({...f,status:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Solicitante</label><Input value={form.requester_name} onChange={e=>setForm(f=>({...f,requester_name:e.target.value}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Centro de Custo</label>
                  <Select value={form.cost_center_id||""} onValueChange={v=>{const cc=costCenters.find(c=>c.id===v);setForm(f=>({...f,cost_center_id:v,cost_center_name:cc?.name||""}));}}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..."/></SelectTrigger>
                    <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{costCenters.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Fornecedor</label>
                  <Select value={form.supplier_name||""} onValueChange={v=>setForm(f=>({...f,supplier_name:v}))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..."/></SelectTrigger>
                    <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{suppliers.map(s=><SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente / Contrato</label>
                  <Select value={form.client_name||""} onValueChange={v=>{const c=clients.find(c=>c.name===v);setForm(f=>({...f,client_name:v,client_id:c?.id||""}));}}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..."/></SelectTrigger>
                    <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700">Itens do Pedido</label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3.5 h-3.5 mr-1"/>Adicionar</Button>
                </div>
                {form.items.length === 0 ? <p className="text-xs text-gray-400 py-2 text-center">Nenhum item adicionado</p> : (
                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                        <div className="col-span-4"><Input placeholder="Descrição" value={item.description} onChange={e=>updateItem(idx,"description",e.target.value)} className="text-xs h-8"/></div>
                        <div className="col-span-2"><Input type="number" placeholder="Qtd" value={item.quantity} onChange={e=>updateItem(idx,"quantity",parseFloat(e.target.value)||0)} className="text-xs h-8"/></div>
                        <div className="col-span-2"><Input placeholder="UN" value={item.unit} onChange={e=>updateItem(idx,"unit",e.target.value)} className="text-xs h-8"/></div>
                        <div className="col-span-2"><Input type="number" placeholder="Vlr Unit" value={item.unit_price} onChange={e=>updateItem(idx,"unit_price",parseFloat(e.target.value)||0)} className="text-xs h-8"/></div>
                        <div className="col-span-1 text-center font-bold text-green-600">R${(item.total||0).toFixed(0)}</div>
                        <div className="col-span-1 text-right"><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={()=>removeItem(idx)}><X className="w-3 h-3"/></Button></div>
                      </div>
                    ))}
                    <div className="text-right font-bold text-green-600 pt-1">Total: R$ {calcTotal(form.items).toLocaleString("pt-BR",{minimumFractionDigits:2})}</div>
                  </div>
                )}
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label><textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none" rows={2} value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Anexo</label>
                <input type="file" id="po-file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleUpload}/>
                <label htmlFor="po-file" className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:border-violet-400 w-fit">
                  <FileText className="w-4 h-4"/>{uploading?"Enviando...":form.attachment_url?"Trocar arquivo":"Selecionar arquivo"}
                </label>
                {form.attachment_url&&<a href={form.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:underline mt-1 block">Ver anexo</a>}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>save.mutate(form)} disabled={save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{save.isPending?"Salvando...":editing?"Atualizar":"Criar Pedido"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}