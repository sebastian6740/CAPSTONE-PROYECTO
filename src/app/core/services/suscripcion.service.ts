import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Preferences } from '@capacitor/preferences';

export interface SuscripcionData {
  activa: boolean;
  fechaInicio: number;
  fechaVencimiento: number;
  plan: 'gratis' | 'premium' | 'pro';
  usuarioId: string;
}

@Injectable({
  providedIn: 'root'
})
export class SuscripcionService {

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) { }

  // Obtener ID del usuario actual de forma segura
  private async obtenerUsuarioId(): Promise<string | null> {
    try {
      const user = this.auth.currentUser;
      return user?.uid || null;
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }
  }

  // Obtener datos de suscripción del usuario actual
  async obtenerSuscripcion(): Promise<SuscripcionData | null> {
    try {
      const usuarioId = await this.obtenerUsuarioId();
      
      if (!usuarioId) {
        return null;
      }

      const docRef = doc(this.firestore, 'suscripciones', usuarioId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as SuscripcionData;
      }
      return null;
    } catch (error) {
      console.warn('No hay suscripción registrada:', error);
      return null;
    }
  }

  // Verificar si el usuario es suscriptor activo
  async esSuscriptorActivo(): Promise<boolean> {
    try {
      const suscripcion = await this.obtenerSuscripcion();
      if (!suscripcion) return false;

      const ahora = Date.now();
      return suscripcion.activa && suscripcion.fechaVencimiento > ahora;
    } catch (error) {
      console.warn('Error verificando suscripción:', error);
      return false;
    }
  }

  // Crear suscripción (después de pago)
  async crearSuscripcion(plan: 'premium' | 'pro'): Promise<boolean> {
    try {
      const usuarioId = await this.obtenerUsuarioId();

      if (!usuarioId) {
        console.error('No hay usuario autenticado');
        return false;
      }

      const ahora = Date.now();
      const diasDuracion = plan === 'pro' ? 365 : 30;
      const fechaVencimiento = ahora + (diasDuracion * 24 * 60 * 60 * 1000);

      const suscripcionData: SuscripcionData = {
        activa: true,
        fechaInicio: ahora,
        fechaVencimiento: fechaVencimiento,
        plan: plan,
        usuarioId: usuarioId
      };

      // Crear documento de suscripción
      await setDoc(doc(this.firestore, 'suscripciones', usuarioId), suscripcionData);

      // Actualizar campo esSuscriptor en el documento del usuario
      await updateDoc(doc(this.firestore, 'usuarios', usuarioId), {
        esSuscriptor: true,
        fechaSuscripcion: new Date()
      });

      // Guardar en preferencias locales
      await Preferences.set({ key: 'es_suscriptor', value: 'true' });

      console.log('✅ Suscripción creada y usuario actualizado correctamente');
      return true;
    } catch (error) {
      console.error('Error creando suscripción:', error);
      return false;
    }
  }

  // Cancelar suscripción
  async cancelarSuscripcion(): Promise<boolean> {
    try {
      const usuarioId = await this.obtenerUsuarioId();

      if (!usuarioId) {
        console.error('No hay usuario autenticado');
        return false;
      }

      // Desactivar suscripción
      await updateDoc(doc(this.firestore, 'suscripciones', usuarioId), {
        activa: false
      });

      // Actualizar campo esSuscriptor en el documento del usuario
      await updateDoc(doc(this.firestore, 'usuarios', usuarioId), {
        esSuscriptor: false
      });

      // Actualizar preferencias locales
      await Preferences.set({ key: 'es_suscriptor', value: 'false' });

      console.log('✅ Suscripción cancelada y usuario actualizado correctamente');
      return true;
    } catch (error) {
      console.error('Error cancelando suscripción:', error);
      return false;
    }
  }

  // Obtener días restantes
  async obtenerDiasRestantes(): Promise<number> {
    try {
      const suscripcion = await this.obtenerSuscripcion();
      if (!suscripcion?.activa) return 0;

      const ahora = Date.now();
      const dias = Math.ceil((suscripcion.fechaVencimiento - ahora) / (1000 * 60 * 60 * 24));
      return Math.max(0, dias);
    } catch (error) {
      return 0;
    }
  }

  // Obtener info de suscripción
  async obtenerInfoSuscripcion(): Promise<{
    esSuscriptor: boolean;
    plan: string;
    diasRestantes: number;
    fechaVencimiento: Date | null;
  }> {
    try {
      const suscripcion = await this.obtenerSuscripcion();
      const diasRestantes = await this.obtenerDiasRestantes();

      return {
        esSuscriptor: suscripcion?.activa ?? false,
        plan: suscripcion?.plan ?? 'gratis',
        diasRestantes: diasRestantes,
        fechaVencimiento: suscripcion?.fechaVencimiento ? new Date(suscripcion.fechaVencimiento) : null
      };
    } catch (error) {
      return {
        esSuscriptor: false,
        plan: 'gratis',
        diasRestantes: 0,
        fechaVencimiento: null
      };
    }
  }
}
