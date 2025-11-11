import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "lucide-react";

export default function AttendanceChart({ timeRecords }) {
  const chartData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const dayRecords = timeRecords.filter(record => {
        const recordDate = format(parseISO(record.timestamp), 'yyyy-MM-dd');
        return recordDate === dateStr;
      });

      const onTime = dayRecords.filter(r => r.status === 'pontual').length;
      const late = dayRecords.filter(r => r.status === 'atrasado').length;
      const total = dayRecords.length;

      last7Days.push({
        name: format(date, 'EEE', { locale: ptBR }),
        date: format(date, 'dd/MM'),
        onTime,
        late,
        total
      });
    }
    return last7Days;
  }, [timeRecords]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Presença - Últimos 7 Dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis 
              dataKey="name" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey="onTime" name="Pontual" fill="#10b981" radius={[8, 8, 0, 0]} />
            <Bar dataKey="late" name="Atrasado" fill="#f59e0b" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}