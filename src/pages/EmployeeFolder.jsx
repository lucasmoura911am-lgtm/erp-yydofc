import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Folder, ChevronRight, Users, ArrowLeft } from "lucide-react";
import DocumentsManager from "../components/employees/DocumentsManager";

export default function EmployeeFolder() {
  const [user, setUser] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-folder", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const { data: allDocs = [] } = useQuery({
    queryKey: ["all-employee-docs", user?.company_id],
    queryFn: () => base44.entities.EmployeeDocument.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const filtered = employees.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.cpf?.includes(search) ||
    e.employee_number?.includes(search)
  );

  const getDocCount = (empId) => allDocs.filter(d => d.employee_id === empId).length;

  if (selectedEmployee) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedEmployee(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2 text-gray-500">
            <Users className="w-4 h-4" />
            <span className="text-sm">Funcionários</span>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedEmployee.full_name}</span>
          </div>
        </div>

        {/* Employee summary card */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                {selectedEmployee.full_name?.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{selectedEmployee.full_name}</p>
                <p className="text-sm text-gray-500">
                  {selectedEmployee.cpf && `CPF: ${selectedEmployee.cpf}`}
                  {selectedEmployee.job_function && ` • ${selectedEmployee.job_function}`}
                  {selectedEmployee.employee_number && ` • Matrícula: ${selectedEmployee.employee_number}`}
                </p>
              </div>
              <Badge className={selectedEmployee.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                {selectedEmployee.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <DocumentsManager
          employeeId={selectedEmployee.id}
          companyId={user?.company_id}
          currentUserEmail={user?.email}
          readOnly={false}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
          <Folder className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pasta dos Colaboradores</h1>
          <p className="text-gray-500 text-sm">Documentos arquivados de cada funcionário</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar por nome, CPF ou matrícula..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum funcionário encontrado</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => {
            const docCount = getDocCount(emp.id);
            return (
              <Card
                key={emp.id}
                className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
                onClick={() => setSelectedEmployee(emp)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                      {emp.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{emp.full_name}</p>
                      <p className="text-xs text-gray-500">{emp.job_function || emp.category || "—"}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <Folder className="w-3 h-3 mr-1" />
                          {docCount} doc{docCount !== 1 ? "s" : ""}
                        </Badge>
                        <Badge className={`text-xs ${emp.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {emp.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}