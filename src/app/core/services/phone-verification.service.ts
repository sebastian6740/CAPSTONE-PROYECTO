import { Injectable, inject } from '@angular/core';
import { Auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, PhoneAuthProvider, linkWithCredential } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';

export interface VerificacionTelefono {
  usuarioId: string;
  telefono: string;
  verificado: boolean;
  fechaVerificacion?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PhoneVerificationService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private confirmationResult: ConfirmationResult | null = null;

  constructor() { }

  // Inicializar reCAPTCHA invisible
  inicializarRecaptcha(containerId: string = 'recaptcha-container'): void {
    try {
      if (!this.recaptchaVerifier) {
        this.recaptchaVerifier = new RecaptchaVerifier(this.auth, containerId, {
          size: 'invisible',
          callback: () => {
            console.log('✅ reCAPTCHA verificado automáticamente');
          },
          'expired-callback': () => {
            console.log('⚠️ reCAPTCHA expirado, se renovará automáticamente');
          }
        });
      }
    } catch (error) {
      console.error('Error inicializando reCAPTCHA:', error);
      throw error;
    }
  }

  // Enviar código de verificación por SMS
  async enviarCodigoVerificacion(telefono: string): Promise<boolean> {
    try {
      const telefonoNormalizado = this.normalizarTelefono(telefono);

      // Inicializar reCAPTCHA si no existe
      if (!this.recaptchaVerifier) {
        this.inicializarRecaptcha();
      }

      console.log('📱 Enviando SMS de verificación a:', telefonoNormalizado);

      // Enviar SMS con Firebase (GRATIS)
      this.confirmationResult = await signInWithPhoneNumber(
        this.auth,
        telefonoNormalizado,
        this.recaptchaVerifier!
      );

      console.log('✅ SMS enviado exitosamente por Firebase');
      return true;
    } catch (error: any) {
      console.error('❌ Error enviando código:', error);

      if (error.code === 'auth/invalid-phone-number') {
        throw new Error('Número de teléfono inválido');
      }

      if (error.code === 'auth/too-many-requests') {
        throw new Error('Demasiados intentos. Intenta de nuevo más tarde.');
      }

      if (error.code === 'auth/quota-exceeded') {
        throw new Error('Cuota de SMS excedida temporalmente. Intenta más tarde.');
      }

      throw new Error('Error al enviar SMS. Verifica tu número.');
    }
  }

  // Verificar el código ingresado por el usuario
  async verificarCodigo(codigo: string, telefono: string, usuarioEmail: string, usuarioPassword: string): Promise<boolean> {
    try {
      if (!this.confirmationResult) {
        throw new Error('No hay confirmación pendiente. Reenvía el código.');
      }

      console.log('🔍 Verificando código...');

      // Verificar el código con Firebase
      const result = await this.confirmationResult.confirm(codigo);

      console.log('✅ Código verificado correctamente');

      // El usuario ahora tiene una cuenta de teléfono verificada
      const phoneUser = result.user;

      // Guardar verificación en Firestore
      await this.guardarVerificacion(phoneUser.uid, telefono);

      return true;
    } catch (error: any) {
      console.error('❌ Error verificando código:', error);

      if (error.code === 'auth/invalid-verification-code') {
        throw new Error('Código inválido. Intenta de nuevo.');
      }

      if (error.code === 'auth/code-expired') {
        throw new Error('El código ha expirado. Solicita uno nuevo.');
      }

      throw new Error('Error al verificar el código.');
    }
  }

  // Guardar verificación en Firestore
  private async guardarVerificacion(usuarioId: string, telefono: string): Promise<void> {
    try {
      const verificacionData: VerificacionTelefono = {
        usuarioId,
        telefono,
        verificado: true,
        fechaVerificacion: Date.now()
      };

      await setDoc(doc(this.firestore, 'verificaciones_telefono', usuarioId), verificacionData);

      // También actualizar el documento del usuario
      const userDocRef = doc(this.firestore, 'usuarios', usuarioId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          telefonoVerificado: true,
          telefono: telefono
        });
      }

      console.log('✅ Verificación guardada en Firestore');
    } catch (error) {
      console.error('Error guardando verificación:', error);
    }
  }

  // Normalizar teléfono a formato internacional
  normalizarTelefono(telefono: string): string {
    // Limpiar el teléfono de caracteres no numéricos
    let telefonoLimpio = telefono.replace(/\s|-|\.|\(|\)/g, '');

    // Si ya tiene +, dejarlo así
    if (telefonoLimpio.startsWith('+')) {
      return telefonoLimpio;
    }

    // Si empieza con 0, removerlo (formato local chileno)
    if (telefonoLimpio.startsWith('0')) {
      telefonoLimpio = telefonoLimpio.substring(1);
    }

    // Si no tiene código de país, asumir Chile (+56)
    if (!telefonoLimpio.startsWith('56')) {
      telefonoLimpio = '56' + telefonoLimpio;
    }

    // Agregar el símbolo +
    return '+' + telefonoLimpio;
  }

  // Validar formato de teléfono
  validarTelefono(telefono: string): boolean {
    const telefonoLimpio = telefono.replace(/\s|-|\.|\(|\)/g, '');
    // Acepta números con o sin +, con 10-15 dígitos
    const regex = /^\+?[0-9]{10,15}$/;
    return regex.test(telefonoLimpio);
  }

  // Limpiar estado del servicio (para reenviar código)
  limpiarEstado(): void {
    this.confirmationResult = null;
    // No limpiar recaptchaVerifier para reutilizarlo
  }

  // Verificar si un teléfono ya está verificado
  async telefonoYaVerificado(telefono: string): Promise<boolean> {
    try {
      const telefonoNormalizado = this.normalizarTelefono(telefono);

      // Buscar en la colección de verificaciones
      // Nota: esto requeriría una consulta más compleja en producción
      // Por ahora retornamos false para permitir la verificación
      return false;
    } catch (error) {
      console.error('Error verificando estado del teléfono:', error);
      return false;
    }
  }
}
