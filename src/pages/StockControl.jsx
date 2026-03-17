import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Pencil, Trash2, AlertTriangle, ArrowUp, ArrowDown, Package, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const EMPTY_ITEM = { name: "", category: "", unit: "UN", quantity: 0, min_quantity: 0, location: "", client_name: "", unit_cost: 0, notes: "", active: true };
const EMPTY_MOV = { type: "entrada", quantity: 1, date: today, reason: "", notes: "" };

export default function StockControl() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [tab, setTab] = useState("estoque");
  const [openItem, setOpenItem] = useState(false);
  const [openMov, setOpenMov] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [movForm, setMovForm] = useState(EMPTY_MOV);
  const [editing, setEditing] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterAlert, setFilterAlert] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock_items", cid],
    queryFn: () => base44.entities.StockItem.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["stock_mov", cid],
    queryFn: () => base44.entities.StockMovement.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["stock_clients", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const saveItem = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: cid || "unknown" };
      return editing ? base44.entities.StockItem.update(editing.id, payload) : base44.entities.StockItem.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock_items"] }); setOpenItem(false); setEditing(null); setForm(EMPTY_ITEM); toast.success("Item salvo!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const delItem = useMutation({
    mutationFn: (id) => base44.entities.StockItem.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock_items"] }); toast.success("Removido!"); },
  });

  const saveMov = useMutation({
    mutationFn: async (data) => {
      const item = items.find(i => i.id === selectedItem.id);
      const qty = data.type === "entrada" ? (item.quantity||0) + data.quantity : Math.max(0, (item.quantity||0) - data.quantity);
      await base44.entities.StockItem.update(selectedItem.id, { quantity: qty });
      return base44.entities.StockMovement.create({
        ...data, company_id: cid || "unknown",
        stock_item_id: selectedItem.id, stock_item_name: selectedItem.name,
        responsible_email: user.email, responsible_name: user.full_name,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock_items"] }); qc.invalidateQueries({ queryKey: ["stock_mov"] }); setOpenMov(false); setMovForm(EMPTY_MOV); setSelectedItem(null); toast.success("Movimentação registrada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const openNewItem = () => { setEditing(null); setForm(EMPTY_ITEM); setOpenItem(true); };
  const openEditItem = (i) => { setEditing(i); setForm({...i}); setOpenItem(true); };
  const openMovModal = (item, type) => { setSelectedItem(item); setMovForm({ ...EMPTY_MOV, type }); setOpenMov(true); };

  const filtered = items.filter(i => {
    const s = filterSearch.toLowerCase();
    const match = !s || i.name?.toLowerCase().includes(s) || i.category?.toLowerCase().includes(s);
    const alert = !filterAlert || (i.quantity <= i.min_quantity);
    return match && alert;
  });

  const lowStock = items.filter(i => i.quantity <= i.min_quantity && i.active !== false);

  const exportCSV = () => {
    const rows = [["Produto","Categoria","Unidade","Qtd Atual","Estoque Mínimo","Localização","Cliente"]];
    filtered.forEach(i => rows.push([i.name||"",i.category||"",i.unit||"",i.quantity||0,i.min_quantity||0,i.location||"",i.client_name||""]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="estoque.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">📦 Controle de Estoque</h1><p className="text-sm text-gray-400">Gestão de materiais e movimentações</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button>
          <Button onClick={openNewItem} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Novo Item</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Total Itens",value:items.length,color:"from-violet-500 to-indigo-600"},{label:"Estoque Baixo",value:lowStock.length,color:lowStock.length>0?"from-red-500 to-orange-500":"from-green-500 to-emerald-500"},{label:"Entradas Hoje",value:movements.filter(m=>m.date===today&&m.type==="entrada").length,color:"from-blue-500 to-cyan-500"},{label:"Saídas Hoje",value:movements.filter(m=>m.date===today&&m.type==="saida").length,color:"from-orange-400 to-red-400"}].map(k=>(
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5"/>
          <div><p className="font-bold text-orange-700 dark:text-orange-300 text-sm">⚠️ {lowStock.length} item(s) com estoque baixo ou zerado</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">{lowStock.slice(0,5).map(i=>i.name).join(", ")}{lowStock.length>5?" e outros...":""}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <Input placeholder="Buscar produto..." value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} className="w-60"/>
        <Button size="sm" variant={filterAlert?"default":"outline"} onClick={()=>setFilterAlert(!filterAlert)} className={filterAlert?"bg-orange-500 text-white":""}>
          <AlertTriangle className="w-3.5 h-3.5 mr-1"/>Estoque Baixo
        </Button>
        <div className="flex gap-1 ml-auto">
          {[["estoque","Estoque"],["movimentacoes","Movimentações"]].map(([v,l])=>(
            <Button key={v} size="sm" variant={tab===v?"default":"ghost"} onClick={()=>setTab(v)} className={tab===v?"bg-violet-600 text-white":""}>{l}</Button>
          ))}
        </div>
      </div>

      {tab === "estoque" && (
        isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(item => {
              const isLow = item.quantity <= item.min_quantity;
              return (
                <Card key={item.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${isLow?"border-l-4 border-l-orange-400":""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">{item.name}</p>
                          {isLow && <Badge className="bg-orange-100 text-orange-700 text-xs">Baixo</Badge>}
                        </div>
                        {item.category && <p className="text-xs text-gray-400">{item.category}</p>}
                        <div className="mt-2 flex items-center gap-3">
                          <div className="text-center"><p className="text-2xl font-black text-violet-600">{item.quantity}</p><p className="text-xs text-gray-400">{item.unit}</p></div>
                          <div className="text-xs text-gray-400">mín: {item.min_quantity}</div>
                          {item.location && <div className="text-xs text-gray-400 truncate">📍 {item.location}</div>}
                        </div>
                        {item.client_name && <p className="text-xs text-blue-500 mt-1">👤 {item.client_name}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs h-8" onClick={()=>openMovModal(item,"entrada")}><ArrowUp className="w-3.5 h-3.5 mr-1"/>Entrada</Button>
                      <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs h-8" onClick={()=>openMovModal(item,"saida")}><ArrowDown className="w-3.5 h-3.5 mr-1"/>Saída</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEditItem(item)}><Pencil className="w-3.5 h-3.5"/></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={()=>delItem.mutate(item.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && <div className="col-span-3 text-center py-16 bg-white dark:bg-gray-900 rounded-2xl"><p className="text-4xl mb-3">📦</p><p className="text-gray-500">Nenhum item no estoque</p><Button onClick={openNewItem} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1"/>Adicionar item</Button></div>}
          </div>
        )
      )}

      {tab === "movimentacoes" && (
        <div className="space-y-3">
          {movements.slice(0,50).map(m => (
            <Card key={m.id} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.type==="entrada"?"bg-green-100":"bg-orange-100"}`}>
                  {m.type==="entrada"?<ArrowUp className="w-4 h-4 text-green-600"/>:<ArrowDown className="w-4 h-4 text-orange-600"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.stock_item_name}</p>
                  <p className="text-xs text-gray-400">{m.reason||m.notes||"—"} · {m.date} · {m.responsible_name}</p>
                </div>
                <div className={`font-bold text-sm ${m.type==="entrada"?"text-green-600":"text-orange-600"}`}>{m.type==="entrada"?"+":"-"}{m.quantity}</div>
              </CardContent>
            </Card>
          ))}
          {movements.length === 0 && <div className="text-center py-12 text-gray-400">Nenhuma movimentação registrada</div>}
        </div>
      )}

      {openItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="font-bold">{editing?"Editar Item":"Novo Item de Estoque"}</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpenItem(false);setEditing(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Produto *</label><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Categoria</label><Input value={form.category||""} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Unidade *</label><Input value={form.unit} placeholder="UN, KG, L..." onChange={e=>setForm(f=>({...f,unit:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Quantidade Atual</label><Input type="number" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:parseFloat(e.target.value)||0}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Estoque Mínimo</label><Input type="number" value={form.min_quantity} onChange={e=>setForm(f=>({...f,min_quantity:parseFloat(e.target.value)||0}))}/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Localização</label><Input value={form.location||""} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente Vinculado</label>
                <Select value={form.client_name||""} onValueChange={v=>setForm(f=>({...f,client_name:v}))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum"/></SelectTrigger>
                  <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Custo Unitário (R$)</label><Input type="number" value={form.unit_cost||0} onChange={e=>setForm(f=>({...f,unit_cost:parseFloat(e.target.value)||0}))}/></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800">
              <Button variant="outline" onClick={()=>{setOpenItem(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>saveItem.mutate(form)} disabled={!form.name||saveItem.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{saveItem.isPending?"Salvando...":editing?"Atualizar":"Salvar"}</Button>
            </div>
          </div>
        </div>
      )}

      {openMov && selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
              <h2 className="font-bold">{movForm.type==="entrada"?"📥 Entrada":"📤 Saída"} — {selectedItem.name}</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpenMov(false);setSelectedItem(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
                  <Select value={movForm.type} onValueChange={v=>setMovForm(f=>({...f,type:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem><SelectItem value="ajuste">Ajuste</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Quantidade *</label><Input type="number" min="1" value={movForm.quantity} onChange={e=>setMovForm(f=>({...f,quantity:parseFloat(e.target.value)||1}))}/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data *</label><Input type="date" value={movForm.date} onChange={e=>setMovForm(f=>({...f,date:e.target.value}))}/></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Motivo</label><Input value={movForm.reason||""} placeholder="Ex: Compra, entrega ao cliente..." onChange={e=>setMovForm(f=>({...f,reason:e.target.value}))}/></div>
              <p className="text-xs text-gray-400">Estoque atual: <b>{selectedItem.quantity} {selectedItem.unit}</b> → Após: <b>{movForm.type==="entrada"?(selectedItem.quantity||0)+movForm.quantity:Math.max(0,(selectedItem.quantity||0)-movForm.quantity)} {selectedItem.unit}</b></p>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800">
              <Button variant="outline" onClick={()=>{setOpenMov(false);setSelectedItem(null);}}>Cancelar</Button>
              <Button onClick={()=>saveMov.mutate(movForm)} disabled={saveMov.isPending} className={movForm.type==="entrada"?"bg-green-500 hover:bg-green-600 text-white":"bg-orange-500 hover:bg-orange-600 text-white"}>{saveMov.isPending?"Salvando...":"Confirmar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}