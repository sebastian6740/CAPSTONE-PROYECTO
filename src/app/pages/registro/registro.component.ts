import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss'],
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
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.formularioRegistro = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{7,}$/)]],
      ciudad: ['', Validators.required],
      contrasena: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', Validators.required],
      terminos: [false, Validators.requiredTrue]
    });
  }

  registrarse() {
    if (this.formularioRegistro.invalid) {
      this.mostrarMensaje('Por favor completa todos los campos correctamente', 'warning');
      return;
    }

    this.cargando = true;
    this.authService.registrar(this.formularioRegistro.value).subscribe({
      next: (resultado) => {
        this.cargando = false;
        if (resultado.exito) {
          this.mostrarMensaje(resultado.mensaje, 'success');
          setTimeout(() => {
            this.router.navigate(['/tabs/tab1']);
          }, 1500);
        } else {
          this.mostrarMensaje(resultado.mensaje, 'danger');
        }
      },
      error: () => {
        this.cargando = false;
        this.mostrarMensaje('Error en el registro', 'danger');
      }
    });
  }

  private async mostrarMensaje(mensaje: string, color: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000,
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