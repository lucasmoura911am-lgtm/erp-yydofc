import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, Shield } from "lucide-react";

export default function SmartPayslipsDashboard() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");

  const [openSign, setOpenSign] = useState(false);
  const [currentPayslip, setCurrentPayslip] = useState(null);
  const [photo, setPhoto] = useState(null);

  const videoRef = useRef(null);
  const signCanvasRef = useRef(null);
  const isDrawing = useRef(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // 🔒 QUERY SEGURA
  const { data: payslips = [] } = useQuery({
    queryKey: ["smart_payslips", user?.company_id, user?.email],
    queryFn: async () => {
      if (!user?.company_id) return [];

      let employeeId = user.employee_id;

      if (!employeeId) {
        const emp = await base44.entities.Employee.filter({
          company_id: user.company_id,
          user_email: user.email
        });
        employeeId = emp?.[0]?.id;
      }

      if (user.role === "admin") {
        return base44.entities.SmartPayslip.filter({ company_id: user.company_id });
      }

      if (employeeId) {
        return base44.entities.SmartPayslip.filter({
          company_id: user.company_id,
          employee_id: employeeId
        });
      }

      return [];
    },
    enabled: !!user?.company_id,
  });

  // 📸 CAMERA
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
  };

  const capturePhoto = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 300, 200);
    setPhoto(canvas.toDataURL("image/png"));
  };

  // ✍️ ASSINATURA
  const startDraw = (e) => {
    isDrawing.current = true;
    draw(e);
  };

  const endDraw = () => {
    isDrawing.current = false;
    signCanvasRef.current.getContext("2d").beginPath();
  };

  const draw = (e) => {
    if (!isDrawing.current) return;

    const canvas = signCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");

    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    const canvas = signCanvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };

  // 🔥 FUNÇÕES AUX
  function dataURLtoFile(dataurl, filename) {
    let arr = dataurl.split(",");
    let mime = arr[0].match(/:(.*?);/)[1];
    let bstr = atob(arr[1]);
    let n = bstr.length;
    let u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  function blankCanvas(canvas) {
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    return blank.toDataURL();
  }

  // 🚀 ASSINAR COM COMPROVANTE
  const signMutation = useMutation({
    mutationFn: async () => {
      const canvas = signCanvasRef.current;

      if (!photo) return alert("Tire a foto");

      if (canvas.toDataURL() === blankCanvas(canvas)) {
        return alert("Desenhe a assinatura");
      }

      const ip = await fetch("https://api.ipify.org?format=json")
        .then(r => r.json())
        .then(d => d.ip);

      const geo = await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos.coords),
          () => resolve(null)
        );
      });

      const device = navigator.userAgent;

      const fotoUpload = await base44.integrations.Core.UploadFile({
        file: dataURLtoFile(photo, "foto.png")
      });

      const assinaturaUpload = await base44.integrations.Core.UploadFile({
        file: dataURLtoFile(canvas.toDataURL(), "assinatura.png")
      });

      // 📄 COMPROVANTE
      const html = `
        <html>
        <body style="font-family: Arial; padding:20px;">
          <h2>COMPROVANTE DE ASSINATURA DIGITAL</h2>

          <p><b>Usuário:</b> ${user.email}</p>
          <p><b>Data:</b> ${new Date().toLocaleString()}</p>
          <p><b>IP:</b> ${ip}</p>
          <p><b>Dispositivo:</b> ${device}</p>
          <p><b>Geo:</b> ${geo ? geo.latitude + "," + geo.longitude : "Não permitido"}</p>

          <h3>Foto</h3>
          <img src="${photo}" width="200"/>

          <h3>Assinatura</h3>
          <img src="${canvas.toDataURL()}" width="200"/>

          <hr/>
          <p>Documento gerado automaticamente.</p>
        </body>
        </html>
      `;

      const file = new File([html], "comprovante.html", { type: "text/html" });

      const comprovanteUpload = await base44.integrations.Core.UploadFile({
        file
      });

      return base44.entities.SmartPayslip.update(currentPayslip.id, {
        status_assinado: "assinado",
        data_assinatura: new Date().toISOString(),
        assinatura_nome: user.email,
        assinatura_ip: ip,
        assinatura_device: device,
        assinatura_geo: geo ? `${geo.latitude},${geo.longitude}` : null,
        assinatura_foto_url: fotoUpload.file_url,
        assinatura_desenho_url: assinaturaUpload.file_url,
        comprovante_assinatura_url: comprovanteUpload.file_url
      });
    },

    onSuccess: () => {
      setOpenSign(false);
      setPhoto(null);
      clearSignature();
      queryClient.invalidateQueries(["smart_payslips"]);
    }
  });

  const filtered = payslips.filter(p =>
    (p.employee_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-2xl font-bold">Holerites</h1>

      <Input
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          {filtered.map(p => (
            <div key={p.id} className="flex justify-between p-4 bg-gray-100 rounded">

              <div>
                <p className="font-semibold">
                  {isAdmin ? p.employee_name : "Seu holerite"}
                </p>
                <Badge>{p.competencia}</Badge>
              </div>

              <div className="flex gap-2">

                <Button onClick={() => window.open(p.arquivo_pdf_individual)}>
                  <Eye className="w-4 h-4" />
                </Button>

                {!isAdmin && p.status_assinado !== "assinado" && (
                  <Button
                    onClick={() => {
                      setCurrentPayslip(p);
                      setOpenSign(true);
                      setTimeout(startCamera, 500);
                    }}
                  >
                    <Shield className="w-4 h-4" />
                    Assinar
                  </Button>
                )}

              </div>

            </div>
          ))}
        </CardContent>
      </Card>

      {openSign && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">

          <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">

            <h2 className="font-bold">Assinar Holerite</h2>

            <video ref={videoRef} autoPlay className="w-full" />

            <Button onClick={capturePhoto}>Tirar Foto</Button>

            {photo && <img src={photo} className="w-full" />}

            <canvas
              ref={signCanvasRef}
              width={300}
              height={150}
              className="border"
              onMouseDown={startDraw}
              onMouseUp={endDraw}
              onMouseMove={draw}
              onTouchStart={startDraw}
              onTouchEnd={endDraw}
              onTouchMove={draw}
            />

            <Button onClick={clearSignature}>Limpar</Button>

            <Button onClick={() => signMutation.mutate()}>
              Confirmar Assinatura
            </Button>

            <Button onClick={() => setOpenSign(false)}>
              Cancelar
            </Button>

          </div>
        </div>
      )}

    </div>
  );
}