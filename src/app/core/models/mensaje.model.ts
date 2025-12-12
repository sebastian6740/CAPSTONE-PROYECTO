export interface Mensaje {
  id: string;
  conversacionId: string;
  emisorId: string;
  receptorId: string;
  tipo: 'texto' | 'foto';  // Tipo de mensaje
  contenido: string;       // Para mensajes de texto o caption de foto
  fotoUrl?: string;        // URL de Firebase Storage para fotos
  fotoMetadata?: {         // Metadata de la foto
    nombre: string;
    tamanio: number;
    ancho?: number;
    alto?: number;
  };
  timestamp: Date;
  leido: boolean;
  estado?: 'subiendo' | 'completado' | 'error';  // Estado de upload para fotos
  errorMensaje?: string;   // Mensaje de error si falla el upload
}

export interface Conversacion {
  id: string;
  participantes: string[]; // Array of user IDs [userId1, userId2]
  ultimoMensaje?: string;
  ultimaActualizacion: Date;
  articuloRelacionado?: {
    id: string;
    nombre: string;
    foto?: string;
  };
  mensajesNoLeidos: { [usuarioId: string]: number }; // Count of unread messages per user
}

export interface Contacto {
  usuarioId: string;
  nombre: string;
  foto?: string;
  ultimaConexion?: Date;
}

export interface ConversacionConDetalles extends Conversacion {
  otroUsuario: Contacto; // The other participant in the conversation
  ultimoMensajeObj?: Mensaje; // Full message object
}
