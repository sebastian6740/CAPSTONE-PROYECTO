import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ComentariosService } from '../../core/services/comentarios.service';
import { Usuario } from '../../core/models/user.model';
import { Comentario, EstadisticasCalificacion } from '../../core/models/comentario.model';

@Component({
  selector: 'app-perfil-publico',
  templateUrl: './perfil-publico.component.html',
  styleUrls: ['./perfil-publico.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule]
})
export class PerfilPublicoComponent implements OnInit {

  usuario?: Usuario;
  usuarioId: string = '';
  comentarios: Comentario[] = [];
  estadisticas?: EstadisticasCalificacion;

  // Formulario para nuevo comentario
  formularioComentario!: FormGroup;
  mostrandoFormulario = false;
  cargando = false;
  yaCalificoUsuario = false;

  // Usuario actual
  usuarioActual?: Usuario | null;
  esMiPerfil = false;

  // URL de imagen por defecto
  fotoDefault = 'assets/img/user-default.png';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private comentariosService: ComentariosService,
    private fb: FormBuilder,
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.usuarioActual = this.authService.getUsuarioActualSync();

    // Obtener ID del usuario desde la ruta
    this.usuarioId = this.route.snapshot.paramMap.get('id') || '';

    if (this.usuarioId) {
      this.cargarDatos();
      this.inicializarFormulario();
    }
  }

  async cargarDatos() {
    // Verificar si es mi propio perfil
    this.esMiPerfil = this.usuarioId === this.usuarioActual?.id;

    // Cargar información del usuario
    const usuarios = await this.authService.obtenerTodosUsuarios();
    this.usuario = usuarios.find((u: Usuario) => u.id === this.usuarioId);

    if (!this.usuario) {
      console.error('Usuario no encontrado');
      this.router.navigate(['/home']);
      return;
    }

    // Cargar comentarios
    this.comentariosService.obtenerComentariosUsuario(this.usuarioId).subscribe(comentarios => {
      this.comentarios = comentarios;
    });

    // Cargar estadísticas
    this.estadisticas = await this.comentariosService.obtenerEstadisticasCalificacion(this.usuarioId);

    // Verificar si ya califiqué al usuario
    if (!this.esMiPerfil) {
      this.yaCalificoUsuario = await this.comentariosService.yaCalificado(this.usuarioId);
    }
  }

  inicializarFormulario() {
    this.formularioComentario = this.fb.group({
      calificacion: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      comentario: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]]
    });
  }

  toggleFormulario() {
    if (this.esMiPerfil) {
      this.mostrarMensaje('No puedes calificarte a ti mismo', 'warning');
      return;
    }

    if (this.yaCalificoUsuario) {
      this.mostrarMensaje('Ya calificaste a este usuario', 'warning');
      return;
    }

    this.mostrandoFormulario = !this.mostrandoFormulario;
  }

  async enviarComentario() {
    if (this.formularioComentario.invalid) {
      this.mostrarMensaje('Por favor completa todos los campos correctamente', 'warning');
      return;
    }

    if (this.esMiPerfil) {
      this.mostrarMensaje('No puedes calificarte a ti mismo', 'warning');
      return;
    }

    if (this.yaCalificoUsuario) {
      this.mostrarMensaje('Ya calificaste a este usuario', 'warning');
      return;
    }

    this.cargando = true;

    try {
      await this.comentariosService.crearComentario({
        usuarioCalificadoId: this.usuarioId,
        calificacion: this.formularioComentario.value.calificacion,
        comentario: this.formularioComentario.value.comentario
      });

      this.mostrarMensaje('✅ Comentario publicado exitosamente', 'success');
      this.mostrandoFormulario = false;
      this.formularioComentario.reset({
        calificacion: 5,
        comentario: ''
      });

      // Recargar datos
      await this.cargarDatos();

    } catch (error: any) {
      console.error('Error al crear comentario:', error);
      this.mostrarMensaje(error.message || 'Error al publicar comentario', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  obtenerFotoUsuario(): string {
    if (this.usuario?.foto && this.usuario.foto.trim() !== '') {
      return this.usuario.foto;
    }
    return this.fotoDefault;
  }

  obtenerEstrellas(): number[] {
    return Array(Math.round(this.usuario?.calificacion || 0)).fill(0);
  }

  obtenerEstrellasComentario(calificacion: number): number[] {
    return Array(calificacion).fill(0);
  }

  formatearFecha(fecha: Date): string {
    const ahora = new Date();
    const fechaComentario = new Date(fecha);

    const diffMs = ahora.getTime() - fechaComentario.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 0) {
      return 'Hoy';
    } else if (diffDias === 1) {
      return 'Ayer';
    } else if (diffDias < 7) {
      return `Hace ${diffDias} días`;
    } else if (diffDias < 30) {
      const semanas = Math.floor(diffDias / 7);
      return `Hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
    } else if (diffDias < 365) {
      const meses = Math.floor(diffDias / 30);
      return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    } else {
      const años = Math.floor(diffDias / 365);
      return `Hace ${años} ${años === 1 ? 'año' : 'años'}`;
    }
  }

  obtenerPorcentajeEstrellas(cantidad: number): number {
    if (!this.estadisticas || this.estadisticas.totalComentarios === 0) {
      return 0;
    }
    return (cantidad / this.estadisticas.totalComentarios) * 100;
  }

  obtenerColorEstrella(estrella: number): string {
    const calificacionActual = this.formularioComentario?.value?.calificacion || 5;
    return estrella <= calificacionActual ? '#FFA000' : '#bbb';
  }

  seleccionarCalificacion(calificacion: number) {
    if (this.formularioComentario) {
      this.formularioComentario.patchValue({ calificacion });
    }
  }

  esUsuarioActualAdmin(): boolean {
    return this.authService.esAdmin();
  }

  esUsuarioAdmin(): boolean {
    return this.usuario?.rol === 'admin';
  }

  volver() {
    this.router.navigate(['/home']);
  }

  private async mostrarMensaje(mensaje: string, color: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      color: color,
      position: 'top',
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}
