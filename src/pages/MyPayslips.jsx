import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MyPayslips() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
    
    const employees = await base44.entities.Employee.filter({ user_email: userData.email });
    if (employees.length > 0) {
      setEmployee(employees[0]);
    }
  };

  const { data: payslips = [] } = useQuery({
    queryKey: ['payslips', employee?.id],
    queryFn: () => employee ? base44.entities.Payslip.filter({ employee_id: employee.id }, '-created_date') : [],
    enabled: !!employee,
  });

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Meus Holerites</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Visualize e baixe seus contracheques
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {payslips.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Nenhum holerite disponível
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Seus holerites aparecerão aqui quando forem disponibilizados
              </p>
            </CardContent>
          </Card>
        ) : (
          payslips.map((payslip) => (
            <Card key={payslip.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {payslip.competence}
                      </p>
                      <Badge variant="outline" className="mt-1">Contracheque</Badge>
                    </div>
                  </div>
                </div>
                
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
                  onClick={() => window.open(payslip.file_url, '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Holerite
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}