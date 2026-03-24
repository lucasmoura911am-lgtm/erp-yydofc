import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, LogIn, Fingerprint, ChevronRight, Bell, X } from "lucide-react";

export default function PublicLanding() {
  const [now, setNow] = useState(new Date());
  const [company, setCompany] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Busca empresa e avisos sem autenticação
    base44.entities.Company.list("name", 1).then(list => {
      if (list?.length > 0) setCompany(list[0]);
    }).catch(() => {});

    base44.entities.Announcement.list("-created_date", 10).then(list => {
      setAnnouncements(list || []);
    }).catch(() => {});
  }, []);

  // Rotaciona avisos automaticamente
  useEffect(() => {
    if (announcements.length <= 1) return;
    const t = setInterval(() => {
      setAnnouncementIdx(i => (i + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(t);
  }, [announcements]);

  const handleClockIn = () => {
    window.location.href = "/PublicClockIn";
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin("/Dashboard");
  };

  const timeStr = format(now, "HH:mm:ss");
  const dateStr = format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dateStrCap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const activeAnnouncements = announcements.filter(a => a.status !== "archived");
  const current = activeAnnouncements[announcementIdx];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-slate-900 to-gray-900 text-white overflow-hidden relative">

      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-12 gap-8">

        {/* Logo + Nome da empresa */}
        <div className="flex flex-col items-center gap-4">
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-20 w-auto object-contain drop-shadow-2xl"
            />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <Clock className="w-10 h-10 text-white" />
            </div>
          )}
          {company?.name && (
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white/95 text-center">
              {company.name}
            </h1>
          )}
        </div>

        {/* Relógio e data */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-6xl md:text-8xl font-mono font-bold tracking-widest text-white tabular-nums drop-shadow-lg">
            {timeStr}
          </div>
          <div className="text-base md:text-lg text-white/60 font-medium">
            {dateStrCap}
          </div>
        </div>

        {/* Aviso em destaque */}
        {activeAnnouncements.length > 0 && (
          <div className="w-full max-w-2xl">
            <div
              className="relative bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-5 cursor-pointer hover:bg-white/8 transition-all"
              onClick={() => setShowAll(true)}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
                  <Bell className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Aviso</span>
                    {activeAnnouncements.length > 1 && (
                      <span className="text-xs text-white/30">{announcementIdx + 1}/{activeAnnouncements.length}</span>
                    )}
                  </div>
                  <p className="font-semibold text-white/90 truncate">{current?.title}</p>
                  {current?.content && (
                    <p className="text-sm text-white/50 mt-0.5 line-clamp-2">{current.content}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
              </div>
              {activeAnnouncements.length > 1 && (
                <div className="flex gap-1 mt-3 justify-center">
                  {activeAnnouncements.map((_, i) => (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); setAnnouncementIdx(i); }}
                      className={`h-1.5 rounded-full transition-all ${i === announcementIdx ? "w-5 bg-yellow-400" : "w-1.5 bg-white/20"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">

          {/* Registrar Ponto - ação principal */}
          <button
            onClick={handleClockIn}
            className="flex-1 group relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-2xl px-8 py-6 font-semibold text-lg shadow-2xl shadow-purple-900/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center gap-2">
              <Fingerprint className="w-9 h-9" />
              <span>Registrar Ponto</span>
              <span className="text-sm font-normal opacity-75">Sem necessidade de login</span>
            </div>
          </button>

          {/* Entrar no sistema */}
          <button
            onClick={handleLogin}
            className="flex-1 group bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/25 text-white rounded-2xl px-8 py-6 font-semibold text-lg backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex flex-col items-center gap-2">
              <LogIn className="w-9 h-9 text-white/70" />
              <span>Entrar no Sistema</span>
              <span className="text-sm font-normal text-white/50">Acesso completo</span>
            </div>
          </button>

        </div>
      </div>

      {/* Rodapé */}
      <div className="relative z-10 text-center py-4 text-white/20 text-xs">
        PontoFlex · Sistema de Gestão
      </div>

      {/* Modal de todos os avisos */}
      {showAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-yellow-400" />
                <span className="font-semibold text-white">Avisos ({activeAnnouncements.length})</span>
              </div>
              <button onClick={() => setShowAll(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-white/5">
              {activeAnnouncements.map((ann, i) => (
                <div key={ann.id || i} className="px-5 py-4">
                  <p className="font-semibold text-white/90 mb-1">{ann.title}</p>
                  {ann.content && <p className="text-sm text-white/55 leading-relaxed">{ann.content}</p>}
                  {ann.created_date && (
                    <p className="text-xs text-white/25 mt-2">
                      {format(new Date(ann.created_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
              ))}
              {activeAnnouncements.length === 0 && (
                <div className="px-5 py-8 text-center text-white/30">Nenhum aviso no momento</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}