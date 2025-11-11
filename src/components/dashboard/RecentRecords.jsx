import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function RecentRecords({ timeRecords, employees }) {
  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.full_name || 'Desconhecido';
  };

  const getEmployeePhoto = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.photo_url;
  };

  const statusColors = {
    pontual: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    atrasado: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    adiantado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    hora_extra: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
  };

  const typeColors = {
    entrada: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    saida: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
    pausa: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    retorno: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Registros Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Local</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeRecords.map((record) => (
                <TableRow key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={getEmployeePhoto(record.employee_id)} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs">
                          {getEmployeeName(record.employee_id).charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{getEmployeeName(record.employee_id)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={typeColors[record.type]}>
                      {record.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(record.timestamp), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[record.status]}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {record.latitude && record.longitude ? (
                      <MapPin className="w-4 h-4 text-green-600" />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}