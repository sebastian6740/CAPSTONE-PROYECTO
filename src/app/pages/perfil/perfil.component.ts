import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, AlertController, ActionSheetController, LoadingController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AuthService } from '../../core/services/auth.service';
import { Usuario } from '../../core/models/user.model';
import { RecompensasService } from '../../core/services/recompensas.service';
import { EstadisticasPuntos } from '../../core/models/recompensas.model';
import { SuscripcionService } from '../../core/services/suscripcion.service';
import { TerminosModalComponent } from '../../components/terminos-modal/terminos-modal.component';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  encapsulation: ViewEncapsulation.None,
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

  // Suscripción
  esSuscriptor: boolean = false;
  infoSuscripcion: any = {
    esSuscriptor: false,
    plan: 'gratis',
    diasRestantes: 0,
    fechaVencimiento: null
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private loadingController: LoadingController,
    private recompensasService: RecompensasService,
    private suscripcionService: SuscripcionService,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    this.cargarDatos();
    this.verificarFoto();
    this.cargarPuntos();
    this.cargarInfoSuscripcion();
  }

  ionViewWillEnter() {
    this.cargarPuntos();
    this.cargarInfoSuscripcion();
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

  /**
   * Validador personalizado para teléfono:
   * - Debe tener formato +569 seguido de 8 dígitos (con o sin espacio)
   */
  validarTelefono(control: any): { [key: string]: any } | null {
    const valor = control.value;

    if (!valor) {
      return null;
    }

    // Permitir +569 con 8 dígitos, con o sin espacios
    const regex = /^\+569\s?\d{8}$/;
    if (!regex.test(valor)) {
      return { formatoTelefono: true };
    }

    return null;
  }

  /**
   * Validador personalizado para biografía:
   * - Si está vacía, es válida (opcional)
   * - Si tiene contenido, debe tener mínimo 30 y máximo 200 caracteres
   */
  validarBiografia(control: any): { [key: string]: any } | null {
    const valor = control.value;

    // Si está vacío, es válido (biografía es opcional)
    if (!valor || valor.trim().length === 0) {
      return null;
    }

    const longitud = valor.trim().length;

    // Si tiene contenido, validar mínimo y máximo
    if (longitud < 30) {
      return { minlength: { requiredLength: 30, actualLength: longitud } };
    }

    if (longitud > 200) {
      return { maxlength: { requiredLength: 200, actualLength: longitud } };
    }

    return null;
  }

  inicializarFormulario() {
    if (this.usuario) {
      this.formularioEdicion = this.fb.group({
        nombre: [this.usuario.nombre, [Validators.required, Validators.minLength(3)]],
        telefono: [this.usuario.telefono, [Validators.required, this.validarTelefono.bind(this)]],
        ciudad: [this.usuario.ciudad, Validators.required],
        biografia: [this.usuario.biografia || '', [this.validarBiografia.bind(this)]]
      });

      // Debug: Log form initialization
      console.log('📝 Formulario inicializado con valores:', this.formularioEdicion.value);
      console.log('📝 Formulario válido:', this.formularioEdicion.valid);

      // Log individual field errors
      Object.keys(this.formularioEdicion.controls).forEach(key => {
        const control = this.formularioEdicion.get(key);
        if (control?.invalid) {
          console.log(`❌ Campo '${key}' inválido:`, control.errors);
        }
      });

      // Subscribe to form changes to debug
      this.formularioEdicion.valueChanges.subscribe(() => {
        console.log('📝 Formulario cambió. Válido:', this.formularioEdicion.valid);
        Object.keys(this.formularioEdicion.controls).forEach(key => {
          const control = this.formularioEdicion.get(key);
          if (control?.invalid) {
            console.log(`❌ Campo '${key}' inválido:`, control.errors);
          }
        });
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
    // Verificar en tiempo real si puede actualizar foto
    const puedeActualizar = this.authService.puedeActualizarFoto();
    const diasRestantes = this.authService.diasParaActualizarFoto();

    if (!puedeActualizar) {
      const alert = await this.alertController.create({
        header: 'Límite de cambios',
        message: `Podrás cambiar tu foto nuevamente en ${diasRestantes} días. Esto ayuda a mantener la confianza en la comunidad.`,
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
            this.authService.logout().subscribe(() => {
              console.log('✅ Sesión cerrada correctamente');
              this.router.navigate(['/login'], { replaceUrl: true });
            });
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

  // ============================================
  // MÉTODOS DE SUSCRIPCIÓN
  // ============================================

  async cargarInfoSuscripcion() {
    this.infoSuscripcion = await this.suscripcionService.obtenerInfoSuscripcion();
    this.esSuscriptor = this.infoSuscripcion.esSuscriptor;
  }

  async cancelarSuscripcion() {
    const alert = await this.alertController.create({
      header: '¿Cancelar suscripción?',
      message: 'Se te cobrarán por cada artículo después de la primera publicación gratuita. ¿Deseas continuar?',
      buttons: [
        {
          text: 'No, mantener',
          role: 'cancel'
        },
        {
          text: 'Sí, cancelar',
          handler: async () => {
            const exito = await this.suscripcionService.cancelarSuscripcion();
            if (exito) {
              const alertExito = await this.alertController.create({
                header: 'Suscripción cancelada',
                message: 'Tu suscripción ha sido cancelada exitosamente.',
                buttons: ['OK']
              });
              await alertExito.present();
              await this.cargarInfoSuscripcion();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  irARecompensas() {
    this.router.navigate(['/recompensas']);
  }

  async verTerminosYCondiciones() {
    const modal = await this.modalController.create({
      component: TerminosModalComponent,
      componentProps: {
        soloLectura: true
      }
    });

    await modal.present();
  }
}