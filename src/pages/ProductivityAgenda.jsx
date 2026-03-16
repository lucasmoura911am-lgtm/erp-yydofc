import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, X, ChevronLeft, ChevronRight, Clock, MapPin, Users, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const TYPES = [
  { value: "reuniao", label: "Reunião", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "visita", label: "Visita", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "ligacao", label: "Ligação", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "apresentacao", label: "Apresentação", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "interno", label: "Interno", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "outro", label: "Outro", color: "bg-orange-100 text-orange-700 border-orange-300" },
];

const STATUS = [
  { value: "agendado", label: "Agendado" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "reagendado", label: "Reagendado" },
];

const EMPTY = { title: "", date: today, start_time: "", end_time: "", location: "", client_or_project: "", description: "", participants: [], type: "reuniao", status: "agendado" };

export default function ProductivityAgenda() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [participantInput, setParticipantInput] = useState("");
  const qc = useQueryClient();

  const [cid, setCid] = useState(null);
  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.company_id) { setCid(u.company_id); return; }
      if (u?.email) base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);
  const enabled = !!user?.email;

  const { data: appointments = [] } = useQuery({
    queryKey: ["pa_list", cid, user?.email],
    queryFn: () => cid
      ? base44.entities.Appointment.filter({ company_id: cid, employee_email: user.email })
      : base44.entities.Appointment.filter({ employee_email: user.email }),
    enabled,
  });

  const save = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Appointment.update(editing.id, data)
      : base44.entities.Appointment.create({ ...data, company_id: cid || "unknown", employee_email: user.email, employee_name: user.full_name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pa_list"] }); qc.invalidateQueries({ queryKey: ["ph_apt"] }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success(editing ? "Compromisso atualizado!" : "Compromisso criado!"); },
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.Appointment.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pa_list"] }); toast.success("Removido!"); },
  });

  const handleEdit = (a) => {
    setEditing(a);
    setForm({ title: a.title, date: a.date, start_time: a.start_time || "", end_time: a.end_time || "", location: a.location || "", client_or_project: a.client_or_project || "", description: a.description || "", participants: a.participants || [], type: a.type || "reuniao", status: a.status || "agendado" });
    setParticipantInput("");
    setOpen(true);
  };

  const addParticipant = () => {
    if (participantInput.trim()) {
      setForm(f => ({ ...f, participants: [...(f.participants || []), participantInput.trim()] }));
      setParticipantInput("");
    }
  };

  // Days to show
  let days = [];
  if (view === "day") {
    days = [currentDate];
  } else if (view === "week") {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    days = eachDayOfInterval({ start, end });
  } else {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    days = eachDayOfInterval({ start, end });
  }

  const navigate = (dir) => {
    if (view === "day") setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + dir); return n; });
    else if (view === "week") setCurrentDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const getAppts = (day) => appointments.filter(a => a.date === format(day, "yyyy-MM-dd") && a.status !== "cancelado").sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const typeItem = (type) => TYPES.find(t => t.value === type) || TYPES[TYPES.length - 1];

  const periodLabel = view === "day"
    ? format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : view === "week"
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM")} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM/yyyy")}`
    : format(currentDate, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">📅 Agenda de Compromissos</h1>
            <p className="text-sm text-gray-400">Gerencie seus compromissos e reuniões</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ ...EMPTY, date: format(currentDate, "yyyy-MM-dd") }); setParticipantInput(""); setOpen(true); }} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Novo Compromisso
          </Button>
        </div>

        {/* VIEW CONTROLS */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 flex-wrap gap-3">
          <div className="flex gap-1">
            {[["day","Dia"],["week","Semana"],["month","Mês"]].map(([v, l]) => (
              <Button key={v} variant={view === v ? "default" : "ghost"} size="sm" onClick={() => setView(v)}
                className={view === v ? "bg-teal-600 text-white" : ""}>{l}</Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 capitalize min-w-48 text-center">{periodLabel}</span>
            <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
        </div>

        {/* CALENDAR */}
        {view === "month" ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="grid grid-cols-7 border-b dark:border-gray-800">
              {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
                <div key={d} className="p-2 text-center text-xs font-bold text-gray-500">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: (startOfMonth(currentDate).getDay() + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-50 dark:border-gray-800/50" />
              ))}
              {days.map(day => {
                const appts = getAppts(day);
                const isToday2 = isSameDay(day, new Date());
                return (
                  <div key={day.toISOString()} className={`min-h-[80px] border-b border-r border-gray-50 dark:border-gray-800/50 p-1.5 ${isToday2 ? "bg-teal-50 dark:bg-teal-900/10" : ""}`}>
                    <p className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday2 ? "bg-teal-500 text-white" : "text-gray-500"}`}>{format(day, "d")}</p>
                    {appts.slice(0, 2).map(a => (
                      <div key={a.id} onClick={() => handleEdit(a)} className={`text-xs px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer ${typeItem(a.type).color}`}>
                        {a.start_time && `${a.start_time} `}{a.title}
                      </div>
                    ))}
                    {appts.length > 2 && <p className="text-xs text-gray-400">+{appts.length - 2} mais</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`grid gap-4 ${view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1"}`}>
            {days.map(day => {
              const appts = getAppts(day);
              const isToday2 = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border ${isToday2 ? "border-teal-400" : "border-gray-100 dark:border-gray-800"} overflow-hidden`}>
                  <div className={`p-2 text-center border-b dark:border-gray-800 ${isToday2 ? "bg-teal-500" : "bg-gray-50 dark:bg-gray-800"}`}>
                    <p className={`text-xs font-bold ${isToday2 ? "text-white" : "text-gray-500"}`}>{format(day, "EEE", { locale: ptBR }).toUpperCase()}</p>
                    <p className={`text-lg font-black ${isToday2 ? "text-white" : "text-gray-700 dark:text-gray-300"}`}>{format(day, "d")}</p>
                  </div>
                  <div className="p-2 space-y-1.5 min-h-[120px]">
                    {appts.length === 0 ? (
                      <button onClick={() => { setEditing(null); setForm({ ...EMPTY, date: format(day, "yyyy-MM-dd") }); setOpen(true); }} className="w-full text-center py-4 text-xs text-gray-300 hover:text-teal-500 transition-colors">+ Add</button>
                    ) : appts.map(a => (
                      <div key={a.id} onClick={() => handleEdit(a)} className={`p-2 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${typeItem(a.type).color}`}>
                        <p className="text-xs font-bold truncate">{a.title}</p>
                        {a.start_time && <p className="text-xs opacity-70 flex items-center gap-1"><Clock className="w-3 h-3" />{a.start_time}{a.end_time ? ` - ${a.end_time}` : ""}</p>}
                        {a.location && <p className="text-xs opacity-70 flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">{editing ? "Editar Compromisso" : "Novo Compromisso"}</h2>
              <div className="flex gap-2">
                {editing && <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => { del.mutate(editing.id); setOpen(false); setEditing(null); }}><Trash2 className="w-4 h-4" /></Button>}
                <Button variant="ghost" size="icon" onClick={() => { setOpen(false); setEditing(null); }}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Título *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Reunião com cliente..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Tipo</label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Data *</label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Início</label>
                  <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Fim</label>
                  <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Local</label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Presencial, online, link..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Cliente / Projeto</label>
                <Input value={form.client_or_project} onChange={e => setForm(f => ({ ...f, client_or_project: e.target.value }))} placeholder="Opcional" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Descrição</label>
                <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent dark:text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-teal-500" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Participantes</label>
                <div className="flex gap-2">
                  <Input placeholder="Email ou nome" value={participantInput} onChange={e => setParticipantInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addParticipant())} />
                  <Button type="button" variant="outline" size="sm" onClick={addParticipant}>Add</Button>
                </div>
                {(form.participants || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.participants.map((p, i) => (
                      <span key={i} className="flex items-center gap-1 bg-teal-50 text-teal-700 text-xs px-2 py-0.5 rounded-full">
                        {p}
                        <button onClick={() => setForm(f => ({ ...f, participants: f.participants.filter((_, j) => j !== i) }))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {editing && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Status</label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800">
              <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={() => save.mutate(form)} disabled={!form.title || !form.date || save.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
                {save.isPending ? "Salvando..." : editing ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}