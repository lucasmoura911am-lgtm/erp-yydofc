import React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function StatsCard({ title, value, icon: Icon, gradient, trend }) {
  return (
    <Card className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-10 rounded-full transform translate-x-16 -translate-y-16`} />
      <CardHeader className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{title}</p>
            <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {value}
            </CardTitle>
            {trend && (
              <div className="flex items-center mt-3 text-sm">
                <TrendingUp className="w-4 h-4 mr-1 text-green-600" />
                <span className="text-green-600 font-medium">{trend}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}