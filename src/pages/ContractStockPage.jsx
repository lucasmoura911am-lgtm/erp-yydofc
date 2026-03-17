import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { Plus, X, Pencil, Trash2, AlertTriangle, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");
const EMPTY = { client_name: "", client_id: "", contract_id: "", product: "", stock_item_id: "", quantity_on_site: 0, daily_consumption: 0, min_quantity: 0, last_replenishment_date: today, next_replenishment_date: "", unit: "UN", notes: "" };

export default function ContractStockPage() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterClient, setFilterClient] = useState("all");
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ["cstock_list", cid],
    queryFn: () => base44.entities.ContractStock.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["cstock_clients", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ["cstock_items", cid],
    queryFn: () => base44.entities.StockItem.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const save = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: cid || "unknown" };
      if (data.daily_consumption > 0 && data.quantity_on_site >= 0) {
        const daysLeft = Math.floor(data.quantity_on_site / data.daily_consumption);
        payload.next_replenishment_date = format(addDays(new Date(), daysLeft), "yyyy-MM-dd");
      }
      return editing ? base44.entities.ContractStock.update(editing.id, payload) : base44.entities.ContractStock.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cstock_list"] }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success("Estoque salvo!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.ContractStock.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cstock_list"] }); toast.success("Removido!"); },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s }); setOpen(true); };

  const getDaysLeft = (s) => {
    if (!s.daily_consumption || s.daily_consumption === 0) return null;
    return Math.floor((s.quantity_on_site || 0) / s.daily_consumption);
  };

  const allClients = [...new Set(stocks.map(s => s.client_name).filter(Boolean))];
  const filtered = stocks.filter(s => filterClient === "all" || s.client_name === filterClient);
  const lowAlert = stocks.filter(s => (s.quantity_on_site || 0) <= (s.min_quantity || 0) && s.min_quantity > 0);

  const exportCSV = () => {
    const rows = [["Cliente","Contrato","Produto","Qtd no Cliente","Consumo Diário","Última Reposição","Próx. Reposição"]];
    filtered.forEach(s => rows.push([s.client_name||"",s.contract_id||"",s.product||"",s.quantity_on_site||0,s.daily_consumption||0,s.last_replenishment_date||"",s.next_replenishment_date||""]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="estoque_contratos.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🏭 Estoque por Contrato</h1><p className="text-sm text-gray-400">Materiais nos clientes</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button><Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Novo Registro</Button></div>
      </div>

      {lowAlert.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5"/>
          <div><p className="font-bold text-orange-700 text-sm">⚠️ {lowAlert.length} item(s) precisam de reposição</p><p className="text-xs text-orange-500">{lowAlert.slice(0,4).map(s=>`${s.product} (${s.client_name})`).join(", ")}</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Total Registros",value:stocks.length,color:"from-violet-500 to-indigo-600"},{label:"Clientes",value:allClients.length,color:"from-blue-500 to-cyan-500"},{label:"Precisam Repor",value:lowAlert.length,color:lowAlert.length>0?"from-orange-400 to-red-400":"from-green-500 to-emerald-500"},{label:"Repor em Breve",value:stocks.filter(s=>getDaysLeft(s)!==null&&getDaysLeft(s)<=3).length,color:"from-yellow-400 to-orange-400"}].map(k=>(
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos os clientes"/></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{allClients.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-2 text-center py-16 bg-white dark:bg-gray-900 rounded-2xl"><p className="text-4xl mb-3">🏭</p><p className="text-gray-500">Nenhum registro de estoque por contrato</p><Button onClick={openNew} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1"/>Adicionar</Button></div>
          ) : filtered.map(s => {
            const daysLeft = getDaysLeft(s);
            const isLow = (s.quantity_on_site||0) <= (s.min_quantity||0) && s.min_quantity > 0;
            const alertDays = daysLeft !== null && daysLeft <= 3;
            return (
              <Card key={s.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${isLow||alertDays?"border-l-4 border-l-orange-400":""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{s.product}</p>
                        {isLow && <Badge className="bg-orange-100 text-orange-700 text-xs">Repor!</Badge>}
                      </div>
                      <p className="text-xs text-gray-400 mb-2">🏢 {s.client_name}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-xl font-black text-violet-600">{s.quantity_on_site}</p>
                          <p className="text-gray-400">{s.unit} no local</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-xl font-black text-blue-600">{s.daily_consumption||0}</p>
                          <p className="text-gray-400">{s.unit}/dia</p>
                        </div>
                      </div>
                      {daysLeft !== null && (
                        <div className={`mt-2 text-xs font-medium px-2 py-1 rounded-lg ${daysLeft<=1?"bg-red-100 text-red-700":daysLeft<=3?"bg-orange-100 text-orange-700":daysLeft<=7?"bg-yellow-100 text-yellow-700":"bg-green-100 text-green-700"}`}>
                          {daysLeft <= 0 ? "🚨 ESTOQUE ZERADO" : `⏱️ ${daysLeft} dia(s) restante(s)`}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">Última reposição: {s.last_replenishment_date||"—"}</p>
                      {s.next_replenishment_date && <p className="text-xs text-gray-400">Próxima: {s.next_replenishment_date}</p>}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(s)}><Pencil className="w-3.5 h-3.5"/></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={()=>del.mutate(s.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="font-bold">{editing?"Editar":"Novo"} Estoque por Contrato</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpen(false);setEditing(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente *</label>
                <Select value={form.client_name||""} onValueChange={v=>{const c=clients.find(c=>c.name===v);setForm(f=>({...f,client_name:v,client_id:c?.id||""}));}}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente"/></SelectTrigger>
                  <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Produto *</label>
                <Select value={form.stock_item_id||""} onValueChange={v=>{const i=stockItems.find(i=>i.id===v);setForm(f=>({...f,stock_item_id:v,product:i?.name||v,unit:i?.unit||"UN"}))}}>
                  <SelectTrigger><SelectValue placeholder="Selecionar produto"/></SelectTrigger>
                  <SelectContent><SelectItem value={null}>Outro</SelectItem>{stockItems.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
                {!form.stock_item_id && <Input className="mt-2" placeholder="Nome do produto" value={form.product||""} onChange={e=>setForm(f=>({...f,product:e.target.value}))}/>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Unidade</label><Input value={form.unit||"UN"} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Qtd no Cliente</label><Input type="number" min="0" value={form.quantity_on_site||0} onChange={e=>setForm(f=>({...f,quantity_on_site:parseFloat(e.target.value)||0}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Consumo Diário</label><Input type="number" min="0" value={form.daily_consumption||0} onChange={e=>setForm(f=>({...f,daily_consumption:parseFloat(e.target.value)||0}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Estoque Mínimo</label><Input type="number" min="0" value={form.min_quantity||0} onChange={e=>setForm(f=>({...f,min_quantity:parseFloat(e.target.value)||0}))}/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Última Reposição</label><Input type="date" value={form.last_replenishment_date||today} onChange={e=>setForm(f=>({...f,last_replenishment_date:e.target.value}))}/></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label><textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none" rows={2} value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
              {form.daily_consumption > 0 && form.quantity_on_site >= 0 && <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">📅 Previsão de reposição: <b>{Math.floor(form.quantity_on_site/form.daily_consumption)} dia(s)</b> de estoque</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>save.mutate(form)} disabled={!form.product||save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{save.isPending?"Salvando...":editing?"Atualizar":"Salvar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}