import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, getMonth, getDate, parseISO, differenceInYears, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Cake, Star, Calendar, Gift, Heart, Sun, TreePine, Flag, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const today = new Date();
const currentMonth = getMonth(today); // 0-indexed

const HOLIDAYS = [
  { month: 1, day: 1, name: "Ano Novo", icon: "🎆", type: "nacional" },
  { month: 2, day: 14, name: "Dia dos Namorados", icon: "💝", type: "comemorativa" },
  { month: 3, day: 8, name: "Dia da Mulher", icon: "👩", type: "comemorativa" },
  { month: 4, day: 21, name: "Tiradentes", icon: "🇧🇷", type: "nacional" },
  { month: 5, day: 1, name: "Dia do Trabalho", icon: "🔨", type: "nacional" },
  { month: 5, day: 12, name: "Dia das Mães", icon: "💐", type: "comemorativa" },
  { month: 6, day: 12, name: "Dia dos Namorados", icon: "❤️", type: "comemorativa" },
  { month: 6, day: 24, name: "Festa Junina (São João)", icon: "🎉", type: "comemorativa" },
  { month: 7, day: 4, name: "Dia do Amigo", icon: "🤝", type: "comemorativa" },
  { month: 8, day: 11, name: "Dia dos Pais", icon: "👨", type: "comemorativa" },
  { month: 9, day: 7, name: "Independência do Brasil", icon: "🇧🇷", type: "nacional" },
  { month: 10, day: 12, name: "Nossa Sra. Aparecida", icon: "⛪", type: "nacional" },
  { month: 10, day: 15, name: "Dia do Professor", icon: "📚", type: "comemorativa" },
  { month: 10, day: 31, name: "Halloween", icon: "🎃", type: "comemorativa" },
  { month: 11, day: 2, name: "Finados", icon: "🕯️", type: "nacional" },
  { month: 11, day: 15, name: "Proclamação da República", icon: "🇧🇷", type: "nacional" },
  { month: 11, day: 20, name: "Consciência Negra", icon: "✊", type: "nacional" },
  { month: 12, day: 25, name: "Natal", icon: "🎄", type: "nacional" },
  { month: 12, day: 31, name: "Véspera de Ano Novo", icon: "🥂", type: "comemorativa" },
];

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const monthColors = [
  "from-sky-400 to-blue-500",       // Jan
  "from-pink-400 to-rose-500",      // Fev
  "from-green-400 to-emerald-500",  // Mar
  "from-violet-400 to-purple-500",  // Abr
  "from-orange-400 to-amber-500",   // Mai
  "from-yellow-400 to-orange-400",  // Jun
  "from-cyan-400 to-teal-500",      // Jul
  "from-indigo-400 to-blue-600",    // Ago
  "from-lime-400 to-green-500",     // Set
  "from-orange-500 to-red-500",     // Out
  "from-slate-400 to-gray-600",     // Nov
  "from-red-400 to-rose-600",       // Dez
];

function getInitials(name = "") {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function avatarColor(name = "") {
  const colors = [
    "bg-violet-500","bg-blue-500","bg-emerald-500","bg-orange-500",
    "bg-pink-500","bg-teal-500","bg-amber-500","bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function BirthdaysAndDates() {
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const cid = user?.company_id;

  const { data: employees = [] } = useQuery({
    queryKey: ["emp_birthdays", cid],
    queryFn: () => base44.entities.Employee.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const activeEmployees = employees.filter(e => e.status !== "inactive");

  // Birthdays for selected month
  const birthdaysThisMonth = activeEmployees
    .filter(e => e.birth_date && (parseISO(e.birth_date).getMonth()) === selectedMonth)
    .map(e => ({
      ...e,
      day: getDate(parseISO(e.birth_date)),
      age: differenceInYears(new Date(today.getFullYear(), selectedMonth, getDate(parseISO(e.birth_date))), parseISO(e.birth_date)),
      isToday: getMonth(today) === selectedMonth && getDate(today) === getDate(parseISO(e.birth_date)),
    }))
    .sort((a, b) => a.day - b.day);

  // Hire anniversaries for selected month
  const hireAnniversaries = activeEmployees
    .filter(e => e.hire_date && (parseISO(e.hire_date).getMonth()) === selectedMonth)
    .map(e => ({
      ...e,
      day: getDate(parseISO(e.hire_date)),
      years: differenceInYears(new Date(today.getFullYear(), selectedMonth, getDate(parseISO(e.hire_date))), parseISO(e.hire_date)),
      isToday: getMonth(today) === selectedMonth && getDate(today) === getDate(parseISO(e.hire_date)),
    }))
    .filter(e => e.years > 0)
    .sort((a, b) => a.day - b.day);

  // Dates for selected month
  const monthHolidays = HOLIDAYS.filter(h => h.month - 1 === selectedMonth).sort((a, b) => a.day - b.day);

  // Today's birthdays for highlight
  const todayBirthdays = activeEmployees.filter(e => {
    if (!e.birth_date) return false;
    const bd = parseISO(e.birth_date);
    return getMonth(bd) === getMonth(today) && getDate(bd) === getDate(today);
  });

  const prevMonth = () => setSelectedMonth(m => (m === 0 ? 11 : m - 1));
  const nextMonth = () => setSelectedMonth(m => (m === 11 ? 0 : m + 1));

  const gradient = monthColors[selectedMonth];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">

      {/* TODAY BIRTHDAY BANNER */}
      {todayBirthdays.length > 0 && (
        <div className="mb-5 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="text-4xl animate-bounce">🎂</div>
          <div>
            <p className="text-white font-bold text-lg">Aniversário Hoje!</p>
            <p className="text-white/90 text-sm">{todayBirthdays.map(e => e.full_name).join(", ")} está fazendo aniversário agora 🎉</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🎉 Aniversários & Datas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Aniversariantes e datas comemorativas do mês</p>
        </div>

        {/* Month selector */}
        <div className={`flex items-center gap-3 bg-gradient-to-r ${gradient} rounded-2xl px-4 py-2.5 shadow-md`}>
          <button onClick={prevMonth} className="text-white/80 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-bold text-lg min-w-28 text-center">{MONTH_NAMES[selectedMonth]}</span>
          <button onClick={nextMonth} className="text-white/80 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Aniversariantes", value: birthdaysThisMonth.length, icon: "🎂", color: "bg-pink-50 dark:bg-pink-900/20 border-pink-100 dark:border-pink-800" },
          { label: "Aniversários de Casa", value: hireAnniversaries.length, icon: "🏆", color: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" },
          { label: "Datas Comemorativas", value: monthHolidays.length, icon: "📅", color: "bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800" },
        ].map(s => (
          <div key={s.label} className={`${s.color} border rounded-2xl p-4 text-center`}>
            <div className="text-3xl mb-1">{s.icon}</div>
            <p className="text-2xl font-black text-gray-800 dark:text-gray-100">{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* BIRTHDAYS */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className={`bg-gradient-to-r ${gradient} p-4`}>
            <div className="flex items-center gap-2">
              <Cake className="w-5 h-5 text-white" />
              <h2 className="text-white font-bold">Aniversariantes do Mês</h2>
            </div>
          </div>
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {birthdaysThisMonth.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Cake className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum aniversariante</p>
              </div>
            ) : birthdaysThisMonth.map(emp => (
              <div key={emp.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${emp.isToday ? "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 shadow-sm" : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                <div className="relative flex-shrink-0">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} alt={emp.full_name} className="w-11 h-11 rounded-full object-cover" />
                  ) : (
                    <div className={`w-11 h-11 rounded-full ${avatarColor(emp.full_name)} flex items-center justify-center text-white font-bold text-sm`}>
                      {getInitials(emp.full_name)}
                    </div>
                  )}
                  {emp.isToday && (
                    <span className="absolute -top-1 -right-1 text-base">🎂</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{emp.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{emp.job_function || "—"}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-xl font-black ${emp.isToday ? "text-orange-500" : "text-gray-700 dark:text-gray-300"}`}>
                    {String(emp.day).padStart(2, "0")}
                  </div>
                  <div className="text-xs text-gray-400">{emp.age} anos</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-5">

          {/* HIRE ANNIVERSARIES */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-white" />
                <h2 className="text-white font-bold">Aniversários de Empresa</h2>
              </div>
            </div>
            <div className="p-4">
              {hireAnniversaries.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Star className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum aniversário de empresa este mês</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {hireAnniversaries.map(emp => (
                    <div key={emp.id} className={`flex items-center gap-3 p-3 rounded-xl ${emp.isToday ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "bg-gray-50 dark:bg-gray-800/50"}`}>
                      <div className="relative flex-shrink-0">
                        {emp.photo_url ? (
                          <img src={emp.photo_url} alt={emp.full_name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full ${avatarColor(emp.full_name)} flex items-center justify-center text-white font-bold text-xs`}>
                            {getInitials(emp.full_name)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{emp.full_name}</p>
                        <p className="text-xs text-gray-400">Dia {String(emp.day).padStart(2, "0")}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                          emp.years >= 10 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          emp.years >= 5 ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}>
                          {emp.years} {emp.years === 1 ? "ano" : "anos"}
                          {emp.years >= 10 ? " 🏆" : emp.years >= 5 ? " ⭐" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* HOLIDAYS & DATES */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-500 to-indigo-600 p-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-white" />
                <h2 className="text-white font-bold">Datas Comemorativas — {MONTH_NAMES[selectedMonth]}</h2>
              </div>
            </div>
            <div className="p-4">
              {monthHolidays.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma data especial este mês</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {monthHolidays.map((h, i) => {
                    const isToday2 = getMonth(today) === selectedMonth && getDate(today) === h.day;
                    return (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isToday2 ? "border-violet-300 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700" :
                        h.type === "nacional" ? "border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/10" :
                        "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"
                      }`}>
                        <div className="text-2xl flex-shrink-0">{h.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{h.name}</p>
                          <p className="text-xs text-gray-400">Dia {String(h.day).padStart(2, "0")} de {MONTH_NAMES[selectedMonth]}</p>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${
                          h.type === "nacional" ? "bg-blue-100 text-blue-700 border-0 dark:bg-blue-900/30 dark:text-blue-400" :
                          "bg-pink-100 text-pink-700 border-0 dark:bg-pink-900/30 dark:text-pink-400"
                        }`}>
                          {h.type === "nacional" ? "🇧🇷 Nacional" : "✨ Comemorativa"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}