import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IonicModule, ToastController, Platform, AlertController, ModalController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { Auth } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { TerminosModalComponent } from '../../components/terminos-modal/terminos-modal.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule]
})
export class LoginComponent implements OnInit, OnDestroy {
  formularioLogin!: FormGroup;
  cargando = false;
  mostrarContrasena = false;
  private backButtonSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private platform: Platform,
    private alertController: AlertController,
    private auth: Auth,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    this.formularioLogin = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(6)]]
    });


    // Verificar si el usuario ya está autenticado
    if (this.authService.estaAutenticado()) {
      console.log('🔒 Usuario ya autenticado, redirigiendo a home...');
      this.router.navigate(['/home'], { replaceUrl: true });
    }
  }

  ngOnDestroy() {
    // Limpiar suscripción del botón de atrás
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }

  ionViewDidEnter() {
    // Deshabilitar el botón de atrás cuando se está en login
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(100, () => {
      // No hacer nada - prevenir que el usuario salga con el botón de atrás
      console.log('🚫 Botón de atrás deshabilitado en login');
    });
  }

  ionViewWillLeave() {
    // Limpiar suscripción al salir de la vista
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }

  login() {
    if (this.formularioLogin.invalid) {
      this.mostrarMensaje('Por favor completa todos los campos', 'warning');
      return;
    }

    this.cargando = true;
    const { email, contrasena } = this.formularioLogin.value;

    console.log('🔐 Iniciando proceso de login para:', email);

    this.authService.login(email, contrasena).subscribe({
      next: async (resultado) => {
        this.cargando = false;
        console.log('📬 Resultado del login:', resultado);

        if (resultado.exito) {
          console.log('✅ Login exitoso');

          // Verificar si el usuario aceptó los términos
          const usuario = this.authService.getUsuarioActualSync();
          if (usuario && !usuario.terminosAceptados) {
            console.log('⚠️ Usuario no ha aceptado términos, mostrando modal...');
            await this.mostrarModalTerminos(usuario.id);
          } else {
            console.log('✅ Usuario con términos aceptados, redirigiendo al home...');
            this.mostrarMensaje('¡Bienvenido!', 'success');
            setTimeout(() => {
              // replaceUrl: true previene que se pueda volver atrás al login
              this.router.navigate(['/home'], { replaceUrl: true });
            }, 1000);
          }
        } else {
          console.error('❌ Login falló:', resultado.mensaje);
          this.mostrarMensaje(resultado.mensaje, 'danger');
        }
      },
      error: (error) => {
        this.cargando = false;
        console.error('💥 Error crítico en el login:', error);
        this.mostrarMensaje('Error al iniciar sesión. Revisa la consola para más detalles.', 'danger');
      },
      complete: () => {
        console.log('🏁 Proceso de login finalizado');
      }
    });
  }

  private async mostrarMensaje(mensaje: string, color: string, duration: number = 2000) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: duration,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  toggleContrasena() {
    this.mostrarContrasena = !this.mostrarContrasena;
  }

  irAlRegistro() {
    this.router.navigate(['/registro']);
  }

  private async mostrarModalTerminos(userId: string) {
    const modal = await this.modalController.create({
      component: TerminosModalComponent,
      backdropDismiss: false, // No se puede cerrar tocando afuera
      keyboardClose: false // No se puede cerrar con el botón de atrás
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();

    if (data?.aceptado) {
      console.log('✅ Usuario aceptó los términos');
      const exito = await this.authService.aceptarTerminos(userId);

      if (exito) {
        this.mostrarMensaje('¡Bienvenido a Trueques APP!', 'success');
        setTimeout(() => {
          this.router.navigate(['/home'], { replaceUrl: true });
        }, 1000);
      } else {
        this.mostrarMensaje('Error al guardar aceptación de términos', 'danger');
      }
    } else {
      console.log('❌ Usuario rechazó los términos');
      this.mostrarMensaje('Debes aceptar los términos para usar la aplicación', 'warning', 3000);
      // Cerrar sesión si rechaza los términos
      this.authService.logout().subscribe(() => {
        console.log('🚪 Sesión cerrada por rechazo de términos');
      });
    }
  }
}