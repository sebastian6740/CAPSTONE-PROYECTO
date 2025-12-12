import { Timestamp } from '@angular/fire/firestore';

export interface Notificacion {
  id?: string;
  usuarioId: string;
  tipo: 'articulo_rechazado' | 'articulo_aprobado' | 'foto_aprobada' | 'foto_rechazada' | 'mensaje' | 'sistema' | 'trueque_completado';
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

  // Para notificaciones de fotos
  fotoRelacionada?: {
    motivo?: string; // Motivo de rechazo
  };

  // Para notificaciones de trueque completado
  truequeRelacionado?: {
    permutaId: string;
    articuloNombre: string;
    rol: 'vendedor' | 'comprador';
    puntos: number;
  };

  // Para navegación
  accion?: {
    tipo: 'navegar' | 'modal';
    ruta?: string;
    datos?: any;
  };
}
