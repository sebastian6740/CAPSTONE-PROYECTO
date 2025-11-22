export interface Mensaje {
  id: string;
  conversacionId: string;
  emisorId: string;
  receptorId: string;
  contenido: string;
  timestamp: Date;
  leido: boolean;
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
