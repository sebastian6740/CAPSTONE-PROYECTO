import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule]
})
export class LoginComponent implements OnInit {
  formularioLogin!: FormGroup;
  cargando = false;
  mostrarContrasena = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.formularioLogin = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  login() {
    if (this.formularioLogin.invalid) {
      this.mostrarMensaje('Por favor completa todos los campos', 'warning');
      return;
    }

    this.cargando = true;
    const { email, contrasena } = this.formularioLogin.value;
    
    this.authService.login(email, contrasena).subscribe({
      next: (resultado) => {
        this.cargando = false;
        if (resultado.exito) {
          this.mostrarMensaje(resultado.mensaje, 'success');
          setTimeout(() => {
            this.router.navigate(['/home']);
          }, 1500);
        } else {
          this.mostrarMensaje(resultado.mensaje, 'danger');
        }
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

  irAlRegistro() {
    this.router.navigate(['/registro']);
  }
}