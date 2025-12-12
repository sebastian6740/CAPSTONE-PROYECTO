import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { PhoneVerificationService } from '../../core/services/phone-verification.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verificar-telefono',
  standalone: true,
  templateUrl: './verificar-telefono.component.html',
  styleUrls: ['./verificar-telefono.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class VerificarTelefonoComponent implements OnInit, OnDestroy {
  codigo: string = '';
  verificando: boolean = false;
  reenviando: boolean = false;
  tiempoRestante: number = 60;
  puedeReenviar: boolean = false;
  telefono: string = '';
  email: string = '';
  password: string = '';
  private intervaloContador: any;

  constructor(
    private phoneService: PhoneVerificationService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    // Obtener datos del registro desde el state de navegación
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state as any;

    if (state) {
      this.telefono = state['telefono'] || '';
      this.email = state['email'] || '';
      this.password = state['password'] || '';
    }
  }

  ngOnInit() {
    // Si no hay teléfono, redirigir al registro
    if (!this.telefono) {
      this.mostrarMensaje('Sesión expirada. Por favor regístrate nuevamente.', 'warning');
      this.router.navigate(['/registro']);
      return;
    }

    this.iniciarContador();
  }

  ngOnDestroy() {
    if (this.intervaloContador) {
      clearInterval(this.intervaloContador);
    }
  }

  iniciarContador() {
    this.tiempoRestante = 60;
    this.puedeReenviar = false;

    this.intervaloContador = setInterval(() => {
      this.tiempoRestante--;
      if (this.tiempoRestante <= 0) {
        this.puedeReenviar = true;
        clearInterval(this.intervaloContador);
      }
    }, 1000);
  }

  async verificarCodigo() {
    if (this.codigo.length !== 6) {
      this.mostrarMensaje('Ingresa el código de 6 dígitos', 'warning');
      return;
    }

    if (!/^\d{6}$/.test(this.codigo)) {
      this.mostrarMensaje('El código debe contener solo números', 'warning');
      return;
    }

    this.verificando = true;

    try {
      // Verificar código con Firebase
      const verificado = await this.phoneService.verificarCodigo(
        this.codigo,
        this.telefono,
        this.email,
        this.password
      );

      if (verificado) {
        this.mostrarMensaje('¡Teléfono verificado exitosamente!', 'success');

        // Redirigir al login
        setTimeout(() => {
          this.router.navigate(['/login'], {
            state: { mensaje: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.' }
          });
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error verificando código:', error);
      this.mostrarMensaje(error.message || 'Error al verificar el código', 'danger');
      this.codigo = '';
    } finally {
      this.verificando = false;
    }
  }

  async reenviarCodigo() {
    if (!this.puedeReenviar || this.reenviando) {
      return;
    }

    this.reenviando = true;

    try {
      // Limpiar estado anterior
      this.phoneService.limpiarEstado();

      // Reenviar código
      const enviado = await this.phoneService.enviarCodigoVerificacion(this.telefono);

      if (enviado) {
        this.mostrarMensaje('Código reenviado exitosamente', 'success');
        this.codigo = '';
        this.iniciarContador();
      }
    } catch (error: any) {
      console.error('Error reenviando código:', error);
      this.mostrarMensaje(error.message || 'Error al reenviar el código', 'danger');
    } finally {
      this.reenviando = false;
    }
  }

  async cancelarVerificacion() {
    const alert = await this.alertController.create({
      header: '¿Cancelar verificación?',
      message: 'Si cancelas, deberás registrarte nuevamente.',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Sí, cancelar',
          handler: () => {
            this.router.navigate(['/registro']);
          }
        }
      ]
    });

    await alert.present();
  }

  private async mostrarMensaje(mensaje: string, color: string, duracion: number = 3000) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: duracion,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  // Formatear el teléfono para mostrarlo
  get telefonoFormateado(): string {
    if (this.telefono.length >= 4) {
      return '***-***-' + this.telefono.slice(-4);
    }
    return this.telefono;
  }
}
