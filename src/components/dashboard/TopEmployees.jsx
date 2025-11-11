import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function TopEmployees({ timeRecords, employees }) {
  const topEmployees = useMemo(() => {
    const employeeStats = {};

    employees.forEach(emp => {
      const empRecords = timeRecords.filter(r => r.employee_id === emp.id);
      const onTimeRecords = empRecords.filter(r => r.status === 'pontual').length;
      const totalRecords = empRecords.length;
      const percentage = totalRecords > 0 ? Math.round((onTimeRecords / totalRecords) * 100) : 0;

      employeeStats[emp.id] = {
        id: emp.id,
        name: emp.full_name,
        photo: emp.photo_url,
        percentage,
        onTimeCount: onTimeRecords,
        totalCount: totalRecords
      };
    });

    return Object.values(employeeStats)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);
  }, [timeRecords, employees]);

  const getMedalColor = (index) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-300 to-gray-500";
    if (index === 2) return "from-orange-400 to-orange-600";
    return "from-blue-400 to-blue-600";
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-600" />
          Ranking de Pontualidade
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topEmployees.map((emp, index) => (
            <div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getMedalColor(index)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                {index + 1}
              </div>
              <Avatar>
                <AvatarImage src={emp.photo} />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                  {emp.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{emp.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {emp.onTimeCount} de {emp.totalCount} registros
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={
                  emp.percentage >= 95 ? 'bg-green-500' :
                  emp.percentage >= 85 ? 'bg-blue-500' :
                  emp.percentage >= 70 ? 'bg-yellow-500' :
                  'bg-orange-500'
                }>
                  {emp.percentage}%
                </Badge>
                {emp.percentage >= 95 && (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}