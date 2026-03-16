import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function resolveVariables(html, employee, company, contract) {
  if (!html) return "";
  let result = html;

  // Logo da empresa
  const logoHtml = company?.logo_url
    ? `<img src="${company.logo_url}" style="max-height:60px;max-width:180px;object-fit:contain" alt="Logo" />`
    : `<span style="font-weight:bold;font-size:16pt">${company?.name || ""}</span>`;
  result = result.replaceAll("{{company.logo}}", logoHtml);

  // Employee fields
  if (employee) {
    Object.keys(employee).forEach((key) => {
      let val = employee[key];
      if (val === null || val === undefined) val = "";
      if (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/)) {
        try { val = format(new Date(val + "T00:00:00"), "dd/MM/yyyy"); } catch {}
      }
      if (typeof val === "boolean") val = val ? "Sim" : "Não";
      if (typeof val === "number" && key === "salary") {
        val = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
      }
      result = result.replaceAll(`{{employee.${key}}}`, String(val));
    });
  }

  // Company fields
  if (company) {
    Object.keys(company).forEach((key) => {
      if (key === "logo_url") return;
      let val = company[key] ?? "";
      result = result.replaceAll(`{{company.${key}}}`, String(val));
    });
  }

  // Contract fields
  if (contract) {
    Object.keys(contract).forEach((key) => {
      let val = contract[key] ?? "";
      if (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/)) {
        try { val = format(new Date(val + "T00:00:00"), "dd/MM/yyyy"); } catch {}
      }
      result = result.replaceAll(`{{contract.${key}}}`, String(val));
    });
  }

  // System variables
  const today = new Date();
  result = result.replaceAll("{{system.today}}", format(today, "dd/MM/yyyy"));
  result = result.replaceAll("{{system.today_extenso}}", format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }));
  result = result.replaceAll("{{system.city}}", company?.address?.split(",")[0] || "");

  return result;
}

export default function DocumentPreview({ html, employee, company, contract }) {
  const resolved = resolveVariables(html || "", employee, company, contract);

  return (
    <div className="bg-white rounded-lg border border-gray-300 shadow-inner overflow-hidden">
      <div
        className="p-10 min-h-96"
        style={{ fontFamily: "Arial, sans-serif", fontSize: "11pt", lineHeight: 1.7, color: "#111" }}
        dangerouslySetInnerHTML={{ __html: resolved }}
      />
    </div>
  );
}