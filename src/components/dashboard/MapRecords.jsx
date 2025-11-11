import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix para ícones do Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function MapRecords({ timeRecords }) {
  const validRecords = useMemo(() => {
    return timeRecords.filter(r => r.latitude && r.longitude);
  }, [timeRecords]);

  const center = useMemo(() => {
    if (validRecords.length === 0) return [-23.5505, -46.6333]; // São Paulo como padrão
    return [validRecords[0].latitude, validRecords[0].longitude];
  }, [validRecords]);

  if (validRecords.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Localizações Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Nenhuma localização registrada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Localizações Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 rounded-lg overflow-hidden">
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {validRecords.map((record) => (
              <Marker
                key={record.id}
                position={[record.latitude, record.longitude]}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-medium">{record.type}</p>
                    <p className="text-gray-600">
                      {format(parseISO(record.timestamp), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}