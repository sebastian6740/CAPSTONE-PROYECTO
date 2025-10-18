import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, AlertController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Usuario } from '../../core/models/user.model';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule]
})
export class PerfilComponent implements OnInit {
  usuario: Usuario | null = null;
  formularioEdicion!: FormGroup;
  editandoPerfil = false;
  cargando = false;
  puedeActualizarFoto = false;
  diasParaFoto = 0;
  Math = Math;

  // Insignias disponibles
  insigniasDisponibles = [
    { nombre: 'Primer Trueque', emoji: '🎉', id: 'primer-trueque' },
    { nombre: 'Usuario Verificado', emoji: '✅', id: 'verificado' },
    { nombre: 'Comerciante', emoji: '🏆', id: 'comerciante' },
    { nombre: 'Coleccionista', emoji: '🎁', id: 'coleccionista' },
    { nombre: 'Social', emoji: '👥', id: 'social' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.cargarDatos();
    this.verificarFoto();
  }

  cargarDatos() {
    this.authService.getUsuarioActual().subscribe(usuario => {
      this.usuario = usuario;
      this.inicializarFormulario();
    });
  }

  verificarFoto() {
    this.puedeActualizarFoto = this.authService.puedeActualizarFoto();
    this.diasParaFoto = this.authService.diasParaActualizarFoto();
  }

  inicializarFormulario() {
    if (this.usuario) {
      this.formularioEdicion = this.fb.group({
        nombre: [this.usuario.nombre, [Validators.required, Validators.minLength(3)]],
        telefono: [this.usuario.telefono, [Validators.required, Validators.pattern(/^\d{7,}$/)]],
        ciudad: [this.usuario.ciudad, Validators.required],
        biografia: [this.usuario.biografia || '', Validators.maxLength(200)]
      });
    }
  }

  toggleEdicion() {
    this.editandoPerfil = !this.editandoPerfil;
  }

  guardarCambios() {
    if (this.formularioEdicion.invalid) {
      this.mostrarMensaje('Por favor completa los campos correctamente', 'warning');
      return;
    }

    this.cargando = true;

    this.authService.actualizarPerfil(this.formularioEdicion.value).subscribe({
      next: (resultado) => {
        this.cargando = false;
        if (resultado.exito) {
          this.mostrarMensaje(resultado.mensaje, 'success');
          this.editandoPerfil = false;
        } else {
          this.mostrarMensaje(resultado.mensaje, 'danger');
        }
      },
      error: () => {
        this.cargando = false;
        this.mostrarMensaje('Error al guardar cambios', 'danger');
      }
    });
  }

  async cambiarFoto() {
    if (!this.puedeActualizarFoto) {
      this.mostrarMensaje(
        `Debes esperar ${this.diasParaFoto} días para cambiar tu foto`,
        'warning'
      );
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cambiar foto de perfil',
      message: 'Selecciona una opción',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cámara',
          handler: () => {
            this.tomarFotoCamara();
          }
        },
        {
          text: 'Galería',
          handler: () => {
            this.seleccionarFotoGaleria();
          }
        }
      ]
    });

    await alert.present();
  }

  tomarFotoCamara() {
    // En producción, usar Capacitor Camera
    const fotoSimulada = 'https://via.placeholder.com/150?text=' + this.usuario?.nombre;
    this.guardarFoto(fotoSimulada);
  }

  seleccionarFotoGaleria() {
    // En producción, usar Capacitor Filesystem
    const fotoSimulada = 'https://via.placeholder.com/150?text=' + this.usuario?.nombre;
    this.guardarFoto(fotoSimulada);
  }

  guardarFoto(foto: string) {
    this.cargando = true;

    this.authService.actualizarFoto(foto).subscribe({
      next: (resultado) => {
        this.cargando = false;
        if (resultado.exito) {
          this.mostrarMensaje(resultado.mensaje, 'success');
          this.verificarFoto();
        } else {
          this.mostrarMensaje(resultado.mensaje, 'warning');
        }
      },
      error: () => {
        this.cargando = false;
        this.mostrarMensaje('Error al actualizar foto', 'danger');
      }
    });
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          handler: () => {
            this.authService.logout();
            this.router.navigate(['/login']);
          }
        }
      ]
    });

    await alert.present();
  }

  async reportarProblema() {
    const alert = await this.alertController.create({
      header: 'Reportar problema',
      inputs: [
        {
          name: 'asunto',
          type: 'text',
          placeholder: 'Asunto'
        },
        {
          name: 'descripcion',
          type: 'textarea',
          placeholder: 'Describe el problema'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar',
          handler: (data) => {
            this.mostrarMensaje('Reporte enviado correctamente', 'success');
          }
        }
      ]
    });

    await alert.present();
  }

  irATrueques() {
    this.router.navigate(['/mis-trueques']);
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

  obtenerInsigniasUsuario() {
    if (!this.usuario) return [];
    return this.insigniasDisponibles.filter(insignia => 
      this.usuario?.insignias.includes(insignia.id)
    );
  }

  obtenerEstrellas(): number[] {
    return Array(Math.round(this.usuario?.calificacion || 0)).fill(0);
  }
}