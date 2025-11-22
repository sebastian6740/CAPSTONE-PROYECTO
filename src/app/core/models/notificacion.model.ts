import { Timestamp } from '@angular/fire/firestore';

export interface Notificacion {
  id?: string;
  usuarioId: string;
  tipo: 'articulo_rechazado' | 'articulo_aprobado' | 'mensaje' | 'sistema';
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha: Date | Timestamp;

  // Datos adicionales según el tipo
  articuloRelacionado?: {
    id: string;
    nombre: string;
    motivo?: string; // Motivo de rechazo
  };

  // Para navegación
  accion?: {
    tipo: 'navegar' | 'modal';
    ruta?: string;
    datos?: any;
  };
}
