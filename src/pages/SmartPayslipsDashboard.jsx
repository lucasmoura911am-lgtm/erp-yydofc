import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText, CheckCircle2, Clock, AlertCircle,
  Search, Eye, Shield
} from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  assinado: { label: "Assinado", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  recusado: { label: "Recusado", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

export default function SmartPayslipsDashboard() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");

  const [openSign, setOpenSign] = useState(false);
  const [currentPayslip, setCurrentPayslip] = useState(null);
  const [photo, setPhoto] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

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
        const employee = await base44.entities.Employee.filter({
          company_id: user.company_id,
          user_email: user.email
        });

        employeeId = employee?.[0]?.id;
      }

      if (user.role === "admin") {
        return base44.entities.SmartPayslip.filter(
          { company_id: user.company_id },
          "-data_upload"
        );
      }

      if (employeeId) {
        return base44.entities.SmartPayslip.filter(
          {
            company_id: user.company_id,
            employee_id: employeeId
          },
          "-data_upload"
        );
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

  // 🔥 ASSINATURA COMPLETA
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!canvasRef.current || canvasRef.current.isEmpty()) {
        alert("Desenhe sua assinatura");
        return;
      }

      if (!photo) {
        alert("Tire a foto");
        return;
      }

      const ip = await fetch("https://api.ipify.org?format=json")
        .then(res => res.json())
        .then(data => data.ip);

      const fotoUpload = await base44.integrations.Core.UploadFile({
        file: dataURLtoFile(photo, "foto.png")
      });

      const assinaturaData = canvasRef.current.toDataURL();
      const assinaturaUpload = await base44.integrations.Core.UploadFile({
        file: dataURLtoFile(assinaturaData, "assinatura.png")
      });

      return base44.entities.SmartPayslip.update(currentPayslip.id, {
        status_assinado: "assinado",
        data_assinatura: new Date().toISOString(),
        assinatura_nome: user.name || user.email,
        assinatura_ip: ip,
        assinatura_foto_url: fotoUpload.file_url,
        assinatura_desenho_url: assinaturaUpload.file_url
      });
    },
    onSuccess: () => {
      setOpenSign(false);
      setPhoto(null);
      queryClient.invalidateQueries(["smart_payslips"]);
    }
  });

  function dataURLtoFile(dataurl, filename) {
    let arr = dataurl.split(',');
    let mime = arr[0].match(/:(.*?);/)[1];
    let bstr = atob(arr[1]);
    let n = bstr.length;
    let u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  }

  const filtered = payslips.filter(p =>
    (p.employee_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-2xl font-bold">Holerites Inteligentes</h1>

      <Input
        placeholder="Buscar funcionário..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Holerites</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">

            {filtered.map(p => {
              const cfg = statusConfig[p.status_assinado] || statusConfig.pendente;
              const Ico = cfg.icon;

              return (
                <div key={p.id} className="flex justify-between p-4 bg-gray-100 rounded">

                  <div>
                    <p className="font-semibold">
                      {isAdmin ? p.employee_name : "Seu holerite"}
                    </p>

                    <div className="flex gap-2 mt-1">
                      <Badge>{p.competencia}</Badge>
                      <Badge className={cfg.color}>
                        <Ico className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2">

                    {p.arquivo_pdf_individual && (
                      <Button size="sm" onClick={() => window.open(p.arquivo_pdf_individual)}>
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    )}

                    {!isAdmin && p.status_assinado !== "assinado" && (
                      <Button
                        className="bg-green-600 text-white"
                        onClick={() => {
                          setCurrentPayslip(p);
                          setOpenSign(true);
                          setTimeout(startCamera, 500);
                        }}
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Assinar
                      </Button>
                    )}

                  </div>
                </div>
              );
            })}

          </div>
        </CardContent>
      </Card>

      {/* 🔥 MODAL ASSINATURA */}
      {openSign && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">

            <h2 className="font-bold text-lg">Assinar Holerite</h2>

            <video ref={videoRef} autoPlay className="w-full rounded" />

            <Button onClick={capturePhoto}>Tirar Foto</Button>

            {photo && <img src={photo} className="w-full rounded" />}

            <SignatureCanvas
              penColor="black"
              canvasProps={{ className: "border w-full h-32" }}
              ref={canvasRef}
            />

            <Button onClick={() => canvasRef.current.clear()}>
              Limpar Assinatura
            </Button>

            <Button
              className="w-full bg-green-600 text-white"
              onClick={() => signMutation.mutate()}
            >
              Confirmar Assinatura
            </Button>

            <Button variant="outline" onClick={() => setOpenSign(false)}>
              Cancelar
            </Button>

          </div>
        </div>
      )}

    </div>
  );
}