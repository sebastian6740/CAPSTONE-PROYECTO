export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  contrasena: string;
  telefono: string;
  ciudad: string;
  foto?: string;
  fechaRegistro: Date;
  calificacion: number;
  biografia?: string;
  trueques_realizados: number;
  trueques_pendientes: number;
  recompensas: number;
  insignias: string[];
  verificado: boolean;
  ultima_actualizacion_foto: Date;
  ultima_actualizacion_perfil: Date;
}