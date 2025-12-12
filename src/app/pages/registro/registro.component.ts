import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { PhoneVerificationService } from '../../core/services/phone-verification.service';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule]
})
export class RegistroComponent implements OnInit {
  formularioRegistro!: FormGroup;
  cargando = false;
  mostrarContrasena = false;
mostrarConfirmarContrasena = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController,
    private phoneService: PhoneVerificationService
  ) {}

  ngOnInit() {
    this.formularioRegistro = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{10,15}$/)]],
      ciudad: ['', Validators.required],
      contrasena: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', Validators.required],
      terminos: [false, Validators.requiredTrue]
    });
  }

  async registrarse() {
    // Validar campos específicos y mostrar mensajes claros
    if (this.formularioRegistro.get('nombre')?.invalid) {
      this.mostrarMensaje('El nombre debe tener al menos 3 caracteres', 'warning');
      return;
    }

    if (this.formularioRegistro.get('email')?.invalid) {
      this.mostrarMensaje('Ingresa un email válido', 'warning');
      return;
    }

    if (this.formularioRegistro.get('telefono')?.invalid) {
      this.mostrarMensaje('El teléfono debe tener entre 10-15 dígitos', 'warning');
      return;
    }

    if (this.formularioRegistro.get('ciudad')?.invalid) {
      this.mostrarMensaje('Selecciona una ciudad', 'warning');
      return;
    }

    if (this.formularioRegistro.get('contrasena')?.invalid) {
      this.mostrarMensaje('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }

    if (this.formularioRegistro.get('confirmarContrasena')?.invalid) {
      this.mostrarMensaje('Confirma tu contraseña', 'warning');
      return;
    }

    // Validar que las contraseñas coincidan
    const contrasena = this.formularioRegistro.get('contrasena')?.value;
    const confirmarContrasena = this.formularioRegistro.get('confirmarContrasena')?.value;
    if (contrasena !== confirmarContrasena) {
      this.mostrarMensaje('Las contraseñas no coinciden', 'warning');
      return;
    }

    if (this.formularioRegistro.get('terminos')?.value !== true) {
      this.mostrarMensaje('Debes aceptar los términos y condiciones', 'warning');
      return;
    }

    // Validar formato del teléfono
    const telefono = this.formularioRegistro.value.telefono;
    if (!this.phoneService.validarTelefono(telefono)) {
      this.mostrarMensaje('Formato de teléfono inválido. Debe tener entre 10-15 dígitos', 'warning');
      return;
    }

    this.cargando = true;
    console.log('🚀 Iniciando proceso de registro...');

    this.authService.registrar(this.formularioRegistro.value).subscribe({
      next: async (resultado) => {
        console.log('📬 Resultado del registro:', resultado);

        if (resultado.exito) {
          console.log('✅ Registro exitoso, iniciando verificación de teléfono...');

          try {
            // Inicializar reCAPTCHA
            this.phoneService.inicializarRecaptcha();

            // Enviar código de verificación por SMS (GRATIS con Firebase)
            const enviado = await this.phoneService.enviarCodigoVerificacion(telefono);

            this.cargando = false;

            if (enviado) {
              this.mostrarMensaje('Código de verificación enviado a tu teléfono', 'success');

              // Navegar a la pantalla de verificación con los datos
              setTimeout(() => {
                this.router.navigate(['/verificar-telefono'], {
                  state: {
                    telefono: telefono,
                    email: this.formularioRegistro.value.email,
                    password: this.formularioRegistro.value.contrasena
                  }
                });
              }, 1000);
            }
          } catch (error: any) {
            this.cargando = false;
            console.error('Error enviando SMS:', error);
            this.mostrarMensaje(error.message || 'Error al enviar SMS de verificación', 'danger');
          }
        } else {
          this.cargando = false;
          console.error('❌ Registro falló:', resultado.mensaje);
          this.mostrarMensaje(resultado.mensaje, 'danger');

          if ((resultado as any).detalleError) {
            console.error('📋 Detalle del error:', (resultado as any).detalleError);
            if ((resultado as any).detalleError.includes('Firestore') || (resultado as any).detalleError.includes('CONFIGURAR')) {
              setTimeout(() => {
                this.mostrarMensaje('⚠️ ' + (resultado as any).detalleError, 'warning', 5000);
              }, 2500);
            }
          }
        }
      },
      error: (error) => {
        this.cargando = false;
        console.error('💥 Error crítico en el registro:', error);
        this.mostrarMensaje('Error crítico al registrar. Revisa la consola para más detalles.', 'danger');
      },
      complete: () => {
        console.log('🏁 Proceso de registro finalizado');
      }
    });
  }

  private async mostrarMensaje(mensaje: string, color: string, duracion: number = 2000) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: duracion,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  toggleContrasena() {
  this.mostrarContrasena = !this.mostrarContrasena;
}

toggleConfirmarContrasena() {
  this.mostrarConfirmarContrasena = !this.mostrarConfirmarContrasena;
}

  irAlLogin() {
    this.router.navigate(['/login']);
  }

  obtenerErrorNombre(): string {
    const control = this.formularioRegistro.get('nombre');
    if (control?.hasError('required')) return 'El nombre es requerido';
    if (control?.hasError('minlength')) return 'Mínimo 3 caracteres';
    return '';
  }

  obtenerErrorEmail(): string {
    const control = this.formularioRegistro.get('email');
    if (control?.hasError('required')) return 'El email es requerido';
    if (control?.hasError('email')) return 'Email inválido';
    return '';
  }

  obtenerErrorTelefono(): string {
    const control = this.formularioRegistro.get('telefono');
    if (control?.hasError('required')) return 'El teléfono es requerido';
    if (control?.hasError('pattern')) return 'Teléfono inválido (mínimo 7 dígitos)';
    return '';
  }

  obtenerErrorContrasena(): string {
    const control = this.formularioRegistro.get('contrasena');
    if (control?.hasError('required')) return 'La contraseña es requerida';
    if (control?.hasError('minlength')) return 'Mínimo 6 caracteres';
    return '';
  }
}