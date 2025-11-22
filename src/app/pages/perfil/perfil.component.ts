import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, AlertController, ActionSheetController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AuthService } from '../../core/services/auth.service';
import { Usuario } from '../../core/models/user.model';
import { RecompensasService } from '../../core/services/recompensas.service';
import { EstadisticasPuntos } from '../../core/models/recompensas.model';

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

  // Sistema de puntos
  puntosActuales = 0;
  estadisticasPuntos: EstadisticasPuntos | null = null;

  // URL de imagen por defecto
  fotoDefault = 'assets/img/user-default.png';

  // Insignias disponibles
  insigniasDisponibles = [
    { nombre: 'Primer Trueque', emoji: '🎉', id: 'primer-trueque' },
    { nombre: 'Usuario Verificado', emoji: '✅', id: 'verificado' },
    { nombre: 'Comerciante', emoji: '🏆', id: 'comerciante' },
    { nombre: 'Coleccionista', emoji: '🎁', id: 'coleccionista' },
    { nombre: 'Social', emoji: '👥', id: 'social' },
    { nombre: 'Experto', emoji: '💎', id: 'experto' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private loadingController: LoadingController,
    private recompensasService: RecompensasService
  ) {}

  ngOnInit() {
    this.cargarDatos();
    this.verificarFoto();
    this.cargarPuntos();
  }

  ionViewWillEnter() {
    this.cargarPuntos();
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
    
    if (!this.editandoPerfil && this.usuario) {
      // Restaurar valores originales si cancela
      this.formularioEdicion.patchValue({
        nombre: this.usuario.nombre,
        telefono: this.usuario.telefono,
        ciudad: this.usuario.ciudad,
        biografia: this.usuario.biografia || ''
      });
    }
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
          this.cargarDatos(); // Recargar datos actualizados
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

  /**
   * Abrir ActionSheet para elegir entre cámara o galería
   */
  async cambiarFoto() {
    if (!this.puedeActualizarFoto) {
      const alert = await this.alertController.create({
        header: 'Límite de cambios',
        message: `Podrás cambiar tu foto nuevamente en ${this.diasParaFoto} días. Esto ayuda a mantener la confianza en la comunidad.`,
        buttons: ['Entendido']
      });
      await alert.present();
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: 'Seleccionar foto de perfil',
      cssClass: 'custom-action-sheet',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera',
          handler: () => {
            this.capturarFoto(CameraSource.Camera);
          }
        },
        {
          text: 'Elegir de galería',
          icon: 'image',
          handler: () => {
            this.capturarFoto(CameraSource.Photos);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  /**
   * Capturar foto con Capacitor Camera
   */
  async capturarFoto(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: source,
        width: 500,
        height: 500,
        promptLabelHeader: 'Foto de perfil',
        promptLabelCancel: 'Cancelar',
        promptLabelPhoto: 'Desde galería',
        promptLabelPicture: 'Tomar foto'
      });

      if (image.dataUrl) {
        await this.guardarFoto(image.dataUrl);
      }
    } catch (error: any) {
      console.error('Error al capturar foto:', error);
      
      // Si el usuario canceló, no mostrar error
      if (error.message && error.message.includes('User cancelled')) {
        return;
      }

      // Error de permisos
      if (error.message && (error.message.includes('permission') || error.message.includes('denied'))) {
        const alert = await this.alertController.create({
          header: 'Permisos necesarios',
          message: 'Para cambiar tu foto de perfil, necesitamos acceso a la cámara o galería. Por favor, activa los permisos en la configuración de tu dispositivo.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      this.mostrarMensaje('No se pudo acceder a la cámara o galería', 'danger');
    }
  }

  /**
   * Guardar foto en el servidor
   */
  async guardarFoto(dataUrl: string) {
    const loading = await this.loadingController.create({
      message: 'Guardando foto...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Convertir DataURL a Blob si es necesario
      // const blob = this.dataURLtoBlob(dataUrl);
      
      this.authService.actualizarFoto(dataUrl).subscribe({
        next: async (resultado) => {
          await loading.dismiss();
          
          if (resultado.exito) {
            this.mostrarMensaje('✅ Foto actualizada correctamente', 'success');
            this.verificarFoto();
            this.cargarDatos(); // Recargar datos con la nueva foto
          } else {
            this.mostrarMensaje(resultado.mensaje || 'Error al actualizar foto', 'danger');
          }
        },
        error: async (error) => {
          await loading.dismiss();
          console.error('Error al guardar foto:', error);
          this.mostrarMensaje('Error al actualizar foto. Intenta nuevamente.', 'danger');
        }
      });
    } catch (error) {
      await loading.dismiss();
      console.error('Error al procesar foto:', error);
      this.mostrarMensaje('Error al procesar la foto', 'danger');
    }
  }

  /**
   * Obtener URL de la foto del usuario o imagen por defecto
   */
  obtenerFotoUsuario(): string {
    // Mostrar foto pendiente si existe, sino la foto aprobada
    if (this.usuario?.foto_pendiente && this.usuario.foto_pendiente.trim() !== '') {
      return this.usuario.foto_pendiente;
    }
    if (this.usuario?.foto && this.usuario.foto.trim() !== '') {
      return this.usuario.foto;
    }
    return this.fotoDefault;
  }

  /**
   * Verificar si hay foto pendiente de revisión
   */
  hayFotoPendiente(): boolean {
    return this.usuario?.estado_foto === 'pendiente' && !!this.usuario?.foto_pendiente;
  }

  /**
   * Verificar si la foto fue rechazada
   */
  fotoRechazada(): boolean {
    return this.usuario?.estado_foto === 'rechazada';
  }

  /**
   * Convertir DataURL a Blob (útil para enviar al backend)
   */
  private dataURLtoBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  }

  volver() {
    this.router.navigate(['/home']);
  }

  irAPanelAdmin() {
    this.router.navigate(['/admin']);
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
      message: 'Describe el problema que encontraste',
      inputs: [
        {
          name: 'asunto',
          type: 'text',
          placeholder: 'Asunto',
          attributes: {
            maxlength: 100
          }
        },
        {
          name: 'descripcion',
          type: 'textarea',
          placeholder: 'Describe el problema (máximo 500 caracteres)',
          attributes: {
            rows: 5,
            maxlength: 500
          }
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar',
          handler: async (data) => {
            if (!data.asunto || !data.descripcion) {
              this.mostrarMensaje('Por favor completa todos los campos', 'warning');
              return false;
            }

            // Aquí enviarías el reporte a tu backend
            // await this.reporteService.enviarReporte(data);
            
            this.mostrarMensaje('✅ Reporte enviado. Te contactaremos pronto.', 'success');
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  irATrueques() {
    this.router.navigate(['/mis-trueques']);
  }

  verMisResenas() {
    if (this.usuario?.id) {
      this.router.navigate(['/perfil-publico', this.usuario.id]);
    }
  }

  esAdmin(): boolean {
    return this.authService.esAdmin();
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

  obtenerInsigniasUsuario() {
    if (!this.usuario) return [];
    return this.insigniasDisponibles.filter(insignia => 
      this.usuario?.insignias.includes(insignia.id)
    );
  }

  obtenerEstrellas(): number[] {
    return Array(Math.round(this.usuario?.calificacion || 0)).fill(0);
  }

  // ============================================
  // MÉTODOS DE PUNTOS Y RECOMPENSAS
  // ============================================

  cargarPuntos() {
    this.puntosActuales = this.recompensasService.obtenerSaldoPuntos();
    this.estadisticasPuntos = this.recompensasService.obtenerEstadisticasPuntos();

    // Suscribirse a cambios en puntos
    this.recompensasService.puntosActualizados$.subscribe(puntos => {
      this.puntosActuales = puntos;
      this.estadisticasPuntos = this.recompensasService.obtenerEstadisticasPuntos();
    });
  }

  irARecompensas() {
    this.router.navigate(['/recompensas']);
  }

  irAHistorialPuntos() {
    this.router.navigate(['/historial-puntos']);
  }
}