import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Eye, Shield, CheckCircle2, Clock, AlertCircle,
  Upload, FileText, Search, BarChart3, Users
} from "lucide-react";
import { Link } from "react-router-dom";

const statusConfig = {
  pendente: { label: "Pendente", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  assinado: { label: "Assinado", className: "bg-green-100 text-green-800 border-green-300" },
  recusado: { label: "Recusado", className: "bg-red-100 text-red-800 border-red-300" },
};

export default function SmartPayslipsDashboard() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [openSign, setOpenSign] = useState(false);
  const [currentPayslip, setCurrentPayslip] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [signing, setSigning] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const signCanvasRef = useRef(null);
  const isDrawing = useRef(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Fecha câmera ao fechar modal
  useEffect(() => {
    if (!openSign) {
      stopCamera();
    }
  }, [openSign]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  // 🔒 LISTAGEM SEGURA — admin vê todos, funcionário vê só os seus
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["smart_payslips", user?.company_id, user?.email],
    queryFn: async () => {
      if (!user?.company_id) return [];

      if (user.role === "admin") {
        return base44.entities.SmartPayslip.filter({ company_id: user.company_id }, "-data_upload");
      }

      // Funcionário: resolve employee_id
      let employeeId = user.employee_id;
      if (!employeeId) {
        const emps = await base44.entities.Employee.filter({
          company_id: user.company_id,
          user_email: user.email
        });
        employeeId = emps?.[0]?.id;
      }

      if (!employeeId) return [];

      return base44.entities.SmartPayslip.filter({
        company_id: user.company_id,
        employee_id: employeeId
      }, "-data_upload");
    },
    enabled: !!user?.company_id,
  });

  const isAdmin = user?.role === "admin";

  // Stats
  const total = payslips.length;
  const assinados = payslips.filter(p => p.status_assinado === "assinado").length;
  const pendentes = payslips.filter(p => p.status_assinado === "pendente").length;
  const pct = total > 0 ? Math.round((assinados / total) * 100) : 0;

  // Filtros
  const filtered = payslips.filter(p => {
    const matchSearch = !search ||
      (p.employee_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.competencia || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.employee_code || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || p.status_assinado === filterStatus;
    return matchSearch && matchStatus;
  });

  // 📄 Abrir comprovante em nova aba
  const openComprovante = (p) => {
    const signed = p.status_assinado === "assinado";
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Holerite — ${p.employee_name} — ${p.competencia}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background:#f5f5f5; }
    .container { max-width: 800px; margin: 20px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.1); }
    .header { background: linear-gradient(135deg,#7c3aed,#2563eb); color:#fff; padding:24px; }
    .header h1 { margin:0; font-size:20px; }
    .header p { margin:4px 0 0; opacity:.8; font-size:13px; }
    .pdf-section { padding: 0; }
    iframe { width:100%; height:600px; border:none; display:block; }
    .cert { padding: 24px; border-top: 2px solid #e5e7eb; }
    .cert h2 { color:#1f2937; font-size:16px; margin-top:0; display:flex; align-items:center; gap:8px; }
    .cert-row { display:flex; gap:8px; margin:6px 0; font-size:13px; }
    .cert-label { font-weight:bold; color:#374151; min-width:120px; }
    .cert-val { color:#4b5563; }
    .photos { display:flex; gap:16px; margin-top:16px; flex-wrap:wrap; }
    .photo-box { text-align:center; }
    .photo-box p { font-size:12px; color:#6b7280; margin:4px 0 0; font-weight:bold; }
    .photo-box img { width:200px; border-radius:8px; border:1px solid #e5e7eb; }
    .badge { display:inline-block; background:#d1fae5; color:#065f46; border-radius:999px; padding:4px 14px; font-size:13px; font-weight:bold; }
    .pending-badge { background:#fef3c7; color:#92400e; }
    .footer { text-align:center; padding:16px; font-size:11px; color:#9ca3af; border-top:1px solid #f3f4f6; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>📄 Holerite — ${p.employee_name}</h1>
    <p>Competência: ${p.competencia}${p.employee_code ? ` &nbsp;|&nbsp; Matrícula: ${p.employee_code}` : ""}</p>
  </div>

  <div class="pdf-section">
    ${p.arquivo_pdf_individual
      ? `<iframe src="${p.arquivo_pdf_individual}" title="Holerite PDF"></iframe>`
      : `<p style="padding:24px;color:#6b7280;">PDF não disponível.</p>`}
  </div>

  <div class="cert">
    <h2>
      ${signed ? "✅" : "⏳"}
      Comprovante de Assinatura Digital
      &nbsp;<span class="badge ${signed ? "" : "pending-badge"}">${signed ? "ASSINADO" : "PENDENTE"}</span>
    </h2>

    ${signed ? `
    <div class="cert-row"><span class="cert-label">Assinado por:</span><span class="cert-val">${p.assinatura_nome || "-"}</span></div>
    <div class="cert-row"><span class="cert-label">Data/hora:</span><span class="cert-val">${p.data_assinatura ? new Date(p.data_assinatura).toLocaleString("pt-BR") : "-"}</span></div>
    <div class="cert-row"><span class="cert-label">IP:</span><span class="cert-val">${p.assinatura_ip || p.ip_assinatura || "-"}</span></div>
    <div class="cert-row"><span class="cert-label">Dispositivo:</span><span class="cert-val" style="word-break:break-all">${p.assinatura_device || p.user_agent_assinatura || "-"}</span></div>
    <div class="cert-row"><span class="cert-label">GPS:</span><span class="cert-val">${p.assinatura_geo || p.gps_assinatura || "Não capturado"}</span></div>

    <div class="photos">
      ${p.assinatura_foto_url || p.foto_assinatura
        ? `<div class="photo-box"><img src="${p.assinatura_foto_url || p.foto_assinatura}" alt="Selfie"/><p>📸 Selfie na assinatura</p></div>`
        : ""}
      ${p.assinatura_desenho_url
        ? `<div class="photo-box"><img src="${p.assinatura_desenho_url}" alt="Assinatura"/><p>✍️ Assinatura manuscrita</p></div>`
        : ""}
    </div>
    ` : `<p style="color:#92400e;">Este holerite ainda não foi assinado pelo funcionário.</p>`}
  </div>

  <div class="footer">Documento gerado pelo sistema PontoFlex — ${new Date().toLocaleString("pt-BR")}</div>
</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  // 📸 Câmera
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setCameraError("Câmera não disponível. Faça upload de uma foto.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0, 320, 240);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  // ✍️ Canvas de assinatura
  const startDraw = (e) => {
    e.preventDefault();
    isDrawing.current = true;
  };
  const endDraw = () => {
    isDrawing.current = false;
    if (signCanvasRef.current)
      signCanvasRef.current.getContext("2d").beginPath();
  };
  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing.current || !signCanvasRef.current) return;
    const canvas = signCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const clearSignature = () => {
    if (!signCanvasRef.current) return;
    const canvas = signCanvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };

  const isCanvasBlank = () => {
    if (!signCanvasRef.current) return true;
    const canvas = signCanvasRef.current;
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() === blank.toDataURL();
  };

  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new File([u8arr], filename, { type: mime });
  };

  // 🚀 ASSINAR
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error("Tire uma selfie antes de assinar.");
      if (isCanvasBlank()) throw new Error("Desenhe sua assinatura no campo.");

      // Coleta metadados
      let ip = "Não capturado";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        ip = data.ip;
      } catch {}

      const geo = await new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          pos => resolve(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
          () => resolve(null),
          { timeout: 5000 }
        );
      });

      // Upload foto e assinatura em paralelo
      const [fotoUpload, assinaturaUpload] = await Promise.all([
        base44.integrations.Core.UploadFile({ file: dataURLtoFile(photo, "selfie.jpg") }),
        base44.integrations.Core.UploadFile({
          file: dataURLtoFile(signCanvasRef.current.toDataURL("image/png"), "assinatura.png")
        }),
      ]);

      return base44.entities.SmartPayslip.update(currentPayslip.id, {
        status_assinado: "assinado",
        data_assinatura: new Date().toISOString(),
        assinatura_nome: user.full_name || user.email,
        assinatura_ip: ip,
        assinatura_device: navigator.userAgent,
        assinatura_geo: geo || "Não capturado",
        assinatura_foto_url: fotoUpload.file_url,
        assinatura_desenho_url: assinaturaUpload.file_url,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart_payslips"] });
      setOpenSign(false);
      setPhoto(null);
      clearSignature();
      setSigning(false);
    },
    onError: (err) => {
      alert(err.message);
      setSigning(false);
    },
  });

  const handleSign = () => {
    setSigning(true);
    signMutation.mutate();
  };

  const openSignModal = (p) => {
    setCurrentPayslip(p);
    setPhoto(null);
    clearSignature();
    setOpenSign(true);
    // Tenta abrir câmera após renderizar o modal
    setTimeout(startCamera, 600);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Holerites Inteligentes
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isAdmin ? "Dashboard de controle e assinatura digital" : "Seus holerites digitais"}
          </p>
        </div>
        {isAdmin && (
          <Link to="/SmartPayslipsUpload">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
              <Upload className="w-4 h-4 mr-2" />
              Upload em Lote
            </Button>
          </Link>
        )}
      </div>

      {/* Stats (admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: total, color: "from-blue-500 to-blue-600", icon: FileText },
            { label: "Assinados", value: assinados, color: "from-green-500 to-green-600", icon: CheckCircle2 },
            { label: "Pendentes", value: pendentes, color: "from-yellow-500 to-orange-500", icon: Clock },
            { label: "% Assinados", value: `${pct}%`, color: "from-purple-500 to-purple-700", icon: BarChart3 },
          ].map(({ label, value, color, icon: Icon }) => (
            <Card key={label} className={`border-0 shadow-md bg-gradient-to-br ${color} text-white`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white/80 text-xs font-medium">{label}</p>
                    <p className="text-2xl font-bold mt-0.5">{value}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-2">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={isAdmin ? "Buscar funcionário, competência, matrícula..." : "Buscar competência..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            {["todos", "pendente", "assinado"].map(s => (
              <Button
                key={s}
                size="sm"
                variant={filterStatus === s ? "default" : "outline"}
                onClick={() => setFilterStatus(s)}
                className={filterStatus === s ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                {s === "todos" ? "Todos" : statusConfig[s]?.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-purple-600" />
            {filtered.length} holerite{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="text-center py-10 text-gray-400">Carregando...</div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Nenhum holerite encontrado</p>
            </div>
          )}

          {filtered.map(p => {
            const cfg = statusConfig[p.status_assinado] || statusConfig.pendente;
            const isAssinado = p.status_assinado === "assinado";

            return (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl gap-3 border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {isAdmin ? (p.employee_name || "—") : "Seu holerite"}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-gray-500">Comp.: {p.competencia}</span>
                      {isAdmin && p.employee_code && (
                        <span className="text-xs text-gray-400">Mat.: {p.employee_code}</span>
                      )}
                      {p.valor_liquido > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          R$ {p.valor_liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                    {isAssinado ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                    {cfg.label}
                  </Badge>

                  {isAssinado && p.data_assinatura && (
                    <span className="text-xs text-gray-400">
                      {new Date(p.data_assinatura).toLocaleDateString("pt-BR")}
                    </span>
                  )}

                  <Button size="sm" variant="outline" onClick={() => openComprovante(p)}>
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    {isAssinado ? "Ver Comprovante" : "Ver Holerite"}
                  </Button>

                  {!isAdmin && !isAssinado && (
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => openSignModal(p)}
                    >
                      <Shield className="w-3.5 h-3.5 mr-1" />
                      Assinar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ====== MODAL DE ASSINATURA ====== */}
      {openSign && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-start overflow-y-auto py-4 px-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl">
            {/* Header do modal */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-2xl px-6 py-4 text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Assinatura Digital
              </h2>
              <p className="text-sm text-white/80 mt-0.5">
                {currentPayslip?.employee_name} — {currentPayslip?.competencia}
              </p>
            </div>

            <div className="p-5 space-y-5">
              {/* Passo 1: Selfie */}
              <div>
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                  1. Selfie para identificação *
                </p>

                {cameraError ? (
                  <div className="space-y-2">
                    <p className="text-xs text-red-500">{cameraError}</p>
                    <label className="cursor-pointer block">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-500 hover:border-purple-400 transition-colors">
                        📁 Enviar foto do dispositivo
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                ) : photo ? (
                  <div className="space-y-2">
                    <img src={photo} alt="Selfie" className="w-full h-48 object-cover rounded-xl border-2 border-green-400" />
                    <Button
                      variant="outline" size="sm" className="w-full"
                      onClick={() => { setPhoto(null); startCamera(); }}
                    >
                      Tirar outra foto
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative bg-black rounded-xl overflow-hidden h-48">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={capturePhoto}>
                      📸 Tirar Selfie
                    </Button>
                  </div>
                )}
              </div>

              {/* Passo 2: Assinatura */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                    2. Desenhe sua assinatura *
                  </p>
                  <Button variant="ghost" size="sm" className="text-xs text-gray-400 h-7 px-2" onClick={clearSignature}>
                    Limpar
                  </Button>
                </div>
                <canvas
                  ref={signCanvasRef}
                  width={480}
                  height={150}
                  className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white touch-none"
                  style={{ cursor: "crosshair" }}
                  onMouseDown={startDraw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onMouseMove={draw}
                  onTouchStart={startDraw}
                  onTouchEnd={endDraw}
                  onTouchMove={draw}
                />
                <p className="text-xs text-gray-400 mt-1">Assine dentro do campo acima com o dedo ou mouse.</p>
              </div>

              {/* Info coletada */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-semibold">Dados coletados na assinatura:</p>
                <p>• IP, data/hora, dispositivo e geolocalização (se permitido)</p>
                <p>• Selfie e imagem da assinatura manuscrita</p>
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpenSign(false)}
                  disabled={signing}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleSign}
                  disabled={signing || !photo}
                >
                  {signing ? "Assinando..." : "✅ Confirmar Assinatura"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}