import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, PopoverController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ArticulosService, Articulo } from '../../core/services/articulos';
import { MensajesService } from '../../core/services/mensajes.service';
import { AuthService } from '../../core/services/auth.service';
import { RecompensasService } from '../../core/services/recompensas.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [IonicModule, CommonModule],
})
export class HomeComponent implements OnInit, OnDestroy {

  // Lista de artículos
  trueques: any[] = [];
  todosLosArticulos: Articulo[] = [];
  categoriaSeleccionada: string = '';

  // Mapeo de categorías a emojis y colores
  categoriasConfig: any = {
    'libros': { emoji: '📚', color: 'color-azul' },
    'videojuegos': { emoji: '🎮', color: 'color-verde' },
    'ropa': { emoji: '👕', color: 'color-rojo' },
    'electronica': { emoji: '📱', color: 'color-morado' },
    'deportes': { emoji: '⚽', color: 'color-naranja' },
    'otros': { emoji: '📦', color: 'color-gris' }
  };

  // Pestaña activa
  tabActiva: string = 'home';

  // Contador de mensajes no leídos
  mensajesNoLeidos: number = 0;

  // Contador de notificaciones no leídas
  notificacionesNoLeidas: number = 0;

  // Sistema de puntos
  puntosActuales: number = 0;

  // Control del header sticky
  headerHidden = false;
  private lastScrollTop = 0;

  // Suscripción para detectar sesión dual
  private sesionDualSubscription?: Subscription;

  constructor(
    private router: Router,
    private articulosService: ArticulosService,
    private mensajesService: MensajesService,
    private authService: AuthService,
    private recompensasService: RecompensasService,
    private notificacionesService: NotificacionesService,
    private popoverController: PopoverController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    // Verificar autenticación antes de cargar datos
    if (!this.authService.estaAutenticado()) {
      console.log('🚫 Usuario no autenticado, redirigiendo a login...');
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    this.cargarArticulos();
    this.cargarMensajesNoLeidos();
    this.cargarNotificaciones();
    this.cargarPuntos();
    this.iniciarDetectorSesionDual();
  }

  ngOnDestroy() {
    // Limpiar suscripción al destruir el componente
    if (this.sesionDualSubscription) {
      this.sesionDualSubscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    // Verificar autenticación cada vez que se entra a la vista
    if (!this.authService.estaAutenticado()) {
      console.log('🚫 Usuario no autenticado, redirigiendo a login...');
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    this.cargarMensajesNoLeidos();
    this.cargarPuntos();
  }

  // Cargar contador de mensajes no leídos
  cargarMensajesNoLeidos() {
    this.mensajesService.obtenerMensajesNoLeidos().subscribe(count => {
      this.mensajesNoLeidos = count;
    });
  }

  // Cargar contador de notificaciones no leídas
  cargarNotificaciones() {
    this.notificacionesService.obtenerNotificacionesNoLeidas().subscribe(count => {
      this.notificacionesNoLeidas = count;
    });
  }

  // Abrir popover de notificaciones
  async abrirNotificaciones(event: any) {
    const { NotificacionesPopoverComponent } = await import('./notificaciones-popover/notificaciones-popover.component');

    const popover = await this.popoverController.create({
      component: NotificacionesPopoverComponent,
      event: event,
      translucent: true,
      cssClass: 'notificaciones-popover'
    });

    await popover.present();
  }

  // Cargar artículos del servicio
  cargarArticulos() {
    this.articulosService.articulos$.subscribe(articulos => {
      // Filtrar artículos según el tipo de usuario
      if (this.authService.esAdmin()) {
        // Admins ven todos los artículos
        this.todosLosArticulos = articulos;
      } else {
        // Usuarios normales solo ven artículos aprobados
        this.todosLosArticulos = articulos.filter(art => art.aprobado === true);
      }

      this.aplicarFiltro();
    });
  }

  // Aplicar filtro de categoría
  aplicarFiltro() {
    let articulosFiltrados = this.todosLosArticulos;

    if (this.categoriaSeleccionada) {
      articulosFiltrados = this.todosLosArticulos.filter(
        art => art.categoria === this.categoriaSeleccionada
      );
    }

    // Convertir artículos al formato del template
    this.trueques = articulosFiltrados.map(art => {
      const config = this.categoriasConfig[art.categoria] || this.categoriasConfig['otros'];
      return {
        id: art.id,
        titulo: art.nombre,
        descripcion: art.descripcion,
        color: config.color,
        emoji: art.fotos.length > 0 ? null : config.emoji,
        foto: art.fotos.length > 0 ? art.fotos[0] : null,
        nombre: art.nombre,
        cambio: art.descripcion,
        ciudad: 'Tu ubicación',
        usuarioId: art.usuarioId // Necesario para saber si es del usuario actual
      };
    });
  }

  // Filtrar por categoría
  filtrarPorCategoria(categoria: string) {
    if (this.categoriaSeleccionada === categoria) {
      this.categoriaSeleccionada = '';
    } else {
      this.categoriaSeleccionada = categoria;
    }
    this.aplicarFiltro();
  }

  // Mostrar detalle
  verDetalle(trueque: any) {
    if (trueque.id) {
      this.router.navigate(['/detalle-articulo', trueque.id]);
    }
  }

  // Ir a crear un nuevo trueque
  irACrearTrueque() {
    console.log('Ir a crear trueque');
    this.router.navigate(['/publicar-articulo']);
  }

  cambiarTab(tab: string) {
    this.tabActiva = tab;
    if (tab === 'messages') {
      this.router.navigate(['/mensajes']);
    } else if (tab === 'perfil') {
      this.router.navigate(['/perfil']);
    }
  }

  // Verificar si el artículo es del usuario actual
  esMiArticulo(trueque: any): boolean {
    const usuarioActual = this.authService.getUsuarioActualSync();
    return trueque.usuarioId === usuarioActual?.id;
  }

  // Verificar si el usuario actual es administrador
  esAdmin(): boolean {
    return this.authService.esAdmin();
  }

  // Contactar al propietario del artículo
  async contactarPropietario(event: Event, trueque: any) {
    event.stopPropagation(); // Evitar que se active el verDetalle

    if (!trueque.usuarioId) {
      console.error('No se puede contactar: artículo sin propietario');
      return;
    }

    try {
      // Crear o obtener conversación con contexto del artículo
      const conversacion = await this.mensajesService.obtenerOCrearConversacion(
        trueque.usuarioId,
        {
          id: trueque.id || '',
          nombre: trueque.nombre,
          foto: trueque.foto
        }
      );

      // Navegar al chat
      this.router.navigate(['/chat', conversacion.id]);
    } catch (error) {
      console.error('Error al crear conversación:', error);
    }
  }

  // Sistema de puntos
  cargarPuntos() {
    this.puntosActuales = this.recompensasService.obtenerSaldoPuntos();

    // Suscribirse a cambios en puntos
    this.recompensasService.puntosActualizados$.subscribe(puntos => {
      this.puntosActuales = puntos;
    });
  }

  irARecompensas() {
    this.router.navigate(['/recompensas']);
  }

  // Detectar scroll para ocultar/mostrar header
  onScroll(event: any) {
    const scrollTop = event.detail.scrollTop;

    // Solo ocultar si se hace scroll hacia abajo más de 50px
    if (scrollTop > this.lastScrollTop && scrollTop > 50) {
      this.headerHidden = true;
    } else if (scrollTop < this.lastScrollTop) {
      this.headerHidden = false;
    }

    this.lastScrollTop = scrollTop;
  }

  // Detector de sesión dual
  iniciarDetectorSesionDual() {
    console.log('🔍 Iniciando detector de sesión dual en home...');

    this.sesionDualSubscription = this.authService.getSesionDualDetectada().subscribe(async (sesionDualDetectada) => {
      if (sesionDualDetectada) {
        console.log('🚨 Sesión dual detectada en home component');
        await this.mostrarAlertaSesionDual();
      }
    });
  }

  // Mostrar alerta de sesión dual
  async mostrarAlertaSesionDual() {
    const alert = await this.alertController.create({
      header: '⚠️ Sesión iniciada en otro dispositivo',
      message: 'Se ha detectado que iniciaste sesión en otro dispositivo. Por seguridad, esta sesión será cerrada.',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Entendido',
          handler: () => {
            console.log('🔒 Usuario confirmó alerta de sesión dual, cerrando sesión...');
            // Cerrar sesión y redirigir al login
            this.authService.logout().subscribe(() => {
              this.router.navigate(['/login'], { replaceUrl: true });
            });
          }
        }
      ]
    });

    await alert.present();
  }

}
