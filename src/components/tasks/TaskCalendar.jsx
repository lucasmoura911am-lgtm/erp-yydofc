import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TaskCalendar({ tasks = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const daysInCalendar = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDay = (day) => {
    return tasks.filter(task => {
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, day);
    });
  };

  const getTaskCountByStatus = (day) => {
    const dayTasks = getTasksForDay(day);
    return {
      total: dayTasks.length,
      completed: dayTasks.filter(t => t.status === 'concluida').length,
      pending: dayTasks.filter(t => t.status === 'pendente').length,
      inProgress: dayTasks.filter(t => t.status === 'em_andamento').length,
      late: dayTasks.filter(t => t.status === 'atrasada').length,
    };
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Calendário de Tarefas
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-[180px] text-center">
              <p className="font-bold text-lg">
                {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {/* Week day headers */}
          {weekDays.map((day) => (
            <div key={day} className="text-center font-semibold text-sm text-gray-600 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {daysInCalendar.map((day, idx) => {
            const counts = getTaskCountByStatus(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            const hasTasks = counts.total > 0;

            return (
              <div
                key={idx}
                className={`
                  min-h-[100px] border rounded-lg p-2 transition-all hover:shadow-md
                  ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900 opacity-50' : 'bg-white dark:bg-gray-800'}
                  ${isToday ? 'border-2 border-purple-600 ring-2 ring-purple-200' : 'border-gray-200 dark:border-gray-700'}
                  ${hasTasks && isCurrentMonth ? 'cursor-pointer' : ''}
                `}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-semibold ${isToday ? 'text-purple-600' : 'text-gray-700 dark:text-gray-300'}`}>
                    {format(day, 'd')}
                  </span>
                  {hasTasks && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {counts.total}
                    </Badge>
                  )}
                </div>

                {hasTasks && isCurrentMonth && (
                  <div className="space-y-1">
                    {counts.completed > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs text-green-700 dark:text-green-400">{counts.completed}</span>
                      </div>
                    )}
                    {counts.inProgress > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-xs text-blue-700 dark:text-blue-400">{counts.inProgress}</span>
                      </div>
                    )}
                    {counts.pending > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                        <span className="text-xs text-gray-700 dark:text-gray-400">{counts.pending}</span>
                      </div>
                    )}
                    {counts.late > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-xs text-red-700 dark:text-red-400">{counts.late}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Concluída</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Em andamento</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Pendente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Atrasada</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}