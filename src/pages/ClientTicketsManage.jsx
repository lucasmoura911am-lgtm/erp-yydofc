import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Search, MessageSquare, Clock, CheckCircle2, AlertCircle, Filter } from "lucide-react";
import { toast } from "sonner";

const TYPE_CONFIG = {
  chamado: { label: "Chamado", color: "bg-blue-100 text-blue-700" },
  ocorrencia: { label: "Ocorrência", color: "bg-orange-100 text-orange-700" },
  solicitacao: { label: "Solicitação", color: "bg-purple-100 text-purple-700" },
  reclamacao: { label: "Reclamação", color: "bg-red-100 text-red-700" },
  elogio: { label: "Elogio", color: "bg-green-100 text-green-700" },
};

const PRIORITY_CONFIG = {
  baixa: { label: "Baixa", color: "bg-gray-100 text-gray-600" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-700" },
};

const STATUS_CONFIG = {
  aberto: { label: "Aberto", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  em_atendimento: { label: "Em Atendimento", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  aguardando_cliente: { label: "Aguardando Cliente", color: "bg-purple-100 text-purple-800", icon: Clock },
  resolvido: { label: "Resolvido", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  fechado: { label: "Fechado", color: "bg-gray-100 text-gray-600", icon: CheckCircle2 },
};

export default function ClientTicketsManage() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [selected, setSelected] = useState(null);
  const [response, setResponse] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setCid(u.company_id);
    });
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["client_tickets_manage", cid],
    queryFn: () => base44.entities.ClientTicket.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_list", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const updateTicket = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ClientTicket.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_tickets_manage"] });
      toast.success("Chamado atualizado!");
      setSelected(prev => ({ ...prev, ...updateTicket.variables?.data }));
    },
  });

  const handleStatusChange = (ticket, status) => {
    const data = { status };
    if (status === "resolvido") data.resolved_at = new Date().toISOString();
    updateTicket.mutate({ id: ticket.id, data });
    if (selected?.id === ticket.id) setSelected(t => ({ ...t, ...data }));
  };

  const handleSendResponse = () => {
    if (!response.trim()) return;
    updateTicket.mutate({ id: selected.id, data: { response, status: "em_atendimento" } });
    setSelected(t => ({ ...t, response, status: "em_atendimento" }));
    setResponse("");
    toast.success("Resposta enviada!");
  };

  const filtered = tickets.filter(t => {
    const s = filterStatus === "all" || t.status === filterStatus;
    const c = filterClient === "all" || t.client_id === filterClient;
    const q = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.number?.includes(search) || t.client_name?.toLowerCase().includes(search.toLowerCase());
    return s && c && q;
  });

  const stats = {
    abertos: tickets.filter(t => t.status === "aberto").length,
    em_atendimento: tickets.filter(t => t.status === "em_atendimento").length,
    resolvidos: tickets.filter(t => t.status === "resolvido" || t.status === "fechado").length,
    urgentes: tickets.filter(t => t.priority === "urgente" && !["resolvido","fechado"].includes(t.status)).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-violet-600"/>Chamados dos Clientes
        </h1>
        <p className="text-sm text-gray-400">Gerencie e responda os chamados abertos pelos clientes no portal</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Abertos", value: stats.abertos, color: "from-yellow-400 to-amber-500" },
          { label: "Em Atendimento", value: stats.em_atendimento, color: "from-blue-500 to-cyan-500" },
          { label: "Resolvidos", value: stats.resolvidos, color: "from-green-500 to-emerald-500" },
          { label: "Urgentes", value: stats.urgentes, color: stats.urgentes > 0 ? "from-red-500 to-rose-600" : "from-gray-400 to-gray-500" },
        ].map(k => (
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p>
            <p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
          <Input placeholder="Buscar chamado..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 bg-white"/>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Status"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Cliente"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List + Detail */}
      <div className={`grid gap-4 ${selected ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Ticket list */}
        <div className="space-y-2">
          {isLoading && <div className="text-center py-12 text-gray-400">Carregando...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p>Nenhum chamado encontrado</p>
            </div>
          )}
          {filtered.map(t => {
            const st = STATUS_CONFIG[t.status];
            const StIcon = st?.icon || Clock;
            const isActive = selected?.id === t.id;
            return (
              <Card key={t.id}
                onClick={() => { setSelected(t); setResponse(t.response || ""); }}
                className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-violet-500" : ""} ${t.priority==="urgente"?"border-l-4 border-l-red-400":""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">{t.title}</span>
                        <Badge className={TYPE_CONFIG[t.type]?.color + " text-xs"}>{TYPE_CONFIG[t.type]?.label}</Badge>
                        <Badge className={PRIORITY_CONFIG[t.priority]?.color + " text-xs"}>{PRIORITY_CONFIG[t.priority]?.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mb-1">{t.number} · 🏢 {t.client_name} · {t.created_date?.slice(0,10)}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge className={st?.color + " flex items-center gap-1 text-xs"}>
                        <StIcon className="w-3 h-3"/>{st?.label}
                      </Badge>
                      <Select value={t.status} onValueChange={v => handleStatusChange(t, v)}>
                        <SelectTrigger className="h-6 text-xs border-gray-200 w-36" onClick={e=>e.stopPropagation()}>
                          <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v} className="text-xs">{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border-0 flex flex-col max-h-[700px]">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">{selected.title}</p>
                <p className="text-xs text-gray-400">{selected.number} · {selected.client_name}</p>
              </div>
              <div className="flex gap-2">
                <Select value={selected.status} onValueChange={v => handleStatusChange(selected, v)}>
                  <SelectTrigger className="h-8 text-xs w-40 border-violet-300">
                    <SelectValue/>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>setSelected(null)}><X className="w-4 h-4"/></Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge className={TYPE_CONFIG[selected.type]?.color}>{TYPE_CONFIG[selected.type]?.label}</Badge>
                <Badge className={PRIORITY_CONFIG[selected.priority]?.color}>{PRIORITY_CONFIG[selected.priority]?.label}</Badge>
                <Badge className={STATUS_CONFIG[selected.status]?.color}>{STATUS_CONFIG[selected.status]?.label}</Badge>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">{selected.description}</p>
              </div>
              {selected.photos?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Fotos anexadas</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.photos.map((p,i) => (
                      <a key={i} href={p} target="_blank" rel="noopener noreferrer">
                        <img src={p} alt="" className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200 hover:border-violet-400"/>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-gray-400 space-y-0.5">
                <p>Aberto por: {selected.opened_by || "-"}</p>
                <p>Data: {selected.created_date?.slice(0,10)}</p>
                {selected.resolved_at && <p>Resolvido em: {selected.resolved_at?.slice(0,10)}</p>}
              </div>
              {selected.response && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                  <p className="text-xs font-bold text-blue-600 mb-1">Resposta enviada ao cliente</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{selected.response}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t dark:border-gray-800">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Responder ao cliente</p>
              <textarea
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 mb-2"
                rows={3}
                placeholder="Escreva a resposta que o cliente verá no portal..."
                value={response}
                onChange={e=>setResponse(e.target.value)}
              />
              <Button onClick={handleSendResponse} disabled={!response.trim() || updateTicket.isPending} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                {updateTicket.isPending ? "Enviando..." : "Enviar Resposta"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}