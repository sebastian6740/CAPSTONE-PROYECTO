import { Injectable, inject, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { Usuario, RespuestaActualizacion, RespuestaFoto } from '../models/user.model';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from '@angular/fire/storage';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private ngZone = inject(NgZone);

  private usuarioActual$ = new BehaviorSubject<Usuario | null>(null);
  private readonly DIAS_LIMITE_FOTO = 30;

  private firestoreDisponible = false;
  private mensajesService: any; // Lazy injection para evitar dependencia circular

  // Detección de sesión dual
  private sesionTokenLocal: string = '';
  private sesionListener: any = null;
  public sesionDualDetectada$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // Verificar disponibilidad de Firestore antes de inicializar
    this.verificarFirestore().then(() => {
      this.inicializarAuthListener();
      // Inicializar admin después de un delay para evitar race conditions
      setTimeout(() => {
        this.inicializarAdminDefault();
      }, 2000);
    });
  }

  // Método para inyectar el servicio de mensajes (lazy injection)
  setMensajesService(mensajesService: any) {
    this.mensajesService = mensajesService;
  }

  /**
   * Verificar que Firestore esté disponible
   */
  private async verificarFirestore(): Promise<void> {
    try {
      // Intentar una operación simple para verificar conectividad
      const testRef = doc(this.firestore, '_test_', 'connection');
      await getDoc(testRef);
      this.firestoreDisponible = true;
      console.log('✅ Firestore conectado correctamente');
    } catch (error: any) {
      console.error('❌ Error al conectar con Firestore:', error);
      if (error.code === 'failed-precondition' || error.message?.includes('offline')) {
        console.error('⚠️ Firestore Database no está configurado o las reglas están bloqueando el acceso');
        console.error('📖 Revisa el archivo CONFIGURAR_FIREBASE.md para instrucciones');
      }
      this.firestoreDisponible = false;
    }
  }

  /**
   * Listener de cambios en autenticación de Firebase
   */
  private inicializarAuthListener() {
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      this.ngZone.run(async () => {
        if (firebaseUser) {
          // Usuario autenticado - cargar datos de Firestore
          const usuario = await this.cargarUsuarioDeFirestore(firebaseUser.uid);
          this.usuarioActual$.next(usuario);

          // Reiniciar listeners de mensajes cuando hay un nuevo usuario
          if (this.mensajesService && typeof this.mensajesService.reiniciarListeners === 'function') {
            console.log('🔄 Reiniciando listeners de mensajes para nuevo usuario...');
            this.mensajesService.reiniciarListeners();
          }
        } else {
          // Usuario no autenticado
          this.usuarioActual$.next(null);
        }
      });
    });
  }

  /**
   * Cargar datos del usuario desde Firestore
   */
  private async cargarUsuarioDeFirestore(uid: string, intentos: number = 0): Promise<Usuario | null> {
    // Verificar que Firestore esté disponible
    if (!this.firestoreDisponible && intentos === 0) {
      console.warn('⚠️ Firestore no está disponible. Intenta configurar Firestore Database en Firebase Console.');
      return null;
    }

    try {
      const userDocRef = doc(this.firestore, 'usuarios', uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        const usuario = {
          ...data,
          id: userDoc.id,
          fechaRegistro: data['fechaRegistro']?.toDate?.() || new Date(),
          ultima_actualizacion_foto: data['ultima_actualizacion_foto']?.toDate?.() || undefined,
          ultima_actualizacion_perfil: data['ultima_actualizacion_perfil']?.toDate?.() || new Date()
        } as Usuario;

        console.log(`✅ Usuario ${usuario.nombre} cargado correctamente`);
        return usuario;
      } else {
        // Si el documento no existe y es el primer intento, esperar un poco y reintentar
        // Esto maneja el caso donde el listener se dispara antes de que Firestore termine de guardar
        if (intentos < 3) {
          console.log(`⏳ Usuario no encontrado, reintentando... (intento ${intentos + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return this.cargarUsuarioDeFirestore(uid, intentos + 1);
        } else {
          console.error(`❌ Usuario con ID ${uid} no encontrado en Firestore después de ${intentos} intentos`);
        }
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error al cargar usuario de Firestore:', error);

      // Mensajes de error más descriptivos
      if (error.code === 'permission-denied') {
        console.error('⛔ Permiso denegado. Verifica las reglas de seguridad de Firestore.');
        console.error('📖 Las reglas deben permitir: allow read, write: if true; (para testing)');
      } else if (error.code === 'unavailable' || error.message?.includes('offline')) {
        console.error('📡 Firestore no disponible. Verifica:');
        console.error('   1. Que Firestore Database esté creado en Firebase Console');
        console.error('   2. Que las reglas de seguridad permitan acceso');
        console.error('   3. Tu conexión a internet');
      }

      // Si hay error de conexión offline y es el primer intento, reintentar
      if (intentos < 3) {
        console.log(`🔄 Reintentando cargar usuario después de error... (intento ${intentos + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.cargarUsuarioDeFirestore(uid, intentos + 1);
      }
      return null;
    }
  }

  /**
   * Inicializar usuario admin por defecto si no existe
   */
  private async inicializarAdminDefault() {
    try {
      // Verificar si ya existe un admin
      const adminQuery = query(
        collection(this.firestore, 'usuarios'),
        where('rol', '==', 'admin')
      );
      const adminSnapshot = await getDocs(adminQuery);

      if (adminSnapshot.empty) {
        // Crear cuenta de Firebase Auth para admin
        const adminEmail = 'admin@trueques.com';
        const adminPassword = 'admin123';

        try {
          const userCredential = await createUserWithEmailAndPassword(
            this.auth,
            adminEmail,
            adminPassword
          );

          const adminData: Omit<Usuario, 'id'> = {
            nombre: 'Administrador',
            email: adminEmail,
            contrasena: '', // No guardamos la contraseña en Firestore
            telefono: '+56912345678',
            ciudad: 'Santiago',
            foto: undefined,
            fechaRegistro: new Date(),
            calificacion: 5,
            biografia: 'Cuenta de administrador del sistema',
            trueques_realizados: 0,
            trueques_pendientes: 0,
            recompensas: 0,
            insignias: ['admin'],
            verificado: true,
            ultima_actualizacion_foto: undefined,
            ultima_actualizacion_perfil: new Date(),
            rol: 'admin'
          };

          // Guardar datos en Firestore
          await setDoc(doc(this.firestore, 'usuarios', userCredential.user.uid), {
            ...adminData,
            fechaRegistro: serverTimestamp(),
            ultima_actualizacion_perfil: serverTimestamp()
          });

          console.log('✅ Usuario admin creado: admin@trueques.com / admin123');

          // Hacer logout del admin para que el usuario normal pueda iniciar sesión
          await signOut(this.auth);
        } catch (error: any) {
          // Si el error es que el email ya existe, simplemente ignorar
          if (error.code !== 'auth/email-already-in-use') {
            console.error('Error al crear admin:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error al verificar admin:', error);
    }
  }

  /**
   * Registrar nuevo usuario
   */
  registrar(datosRegistro: any): Observable<{exito: boolean, mensaje: string, detalleError?: string}> {
    // Validación previa
    if (datosRegistro.contrasena !== datosRegistro.confirmarContrasena) {
      return of({
        exito: false,
        mensaje: 'Las contraseñas no coinciden'
      });
    }

    // Verificar disponibilidad de Firestore
    if (!this.firestoreDisponible) {
      return of({
        exito: false,
        mensaje: 'Base de datos no disponible',
        detalleError: 'Firestore Database no está configurado. Revisa CONFIGURAR_FIREBASE.md'
      });
    }

    console.log('📝 Iniciando registro de usuario:', datosRegistro.email);

    return from(
      createUserWithEmailAndPassword(
        this.auth,
        datosRegistro.email,
        datosRegistro.contrasena
      )
    ).pipe(
      switchMap(async (userCredential) => {
        console.log('✅ Usuario creado en Firebase Auth:', userCredential.user.uid);

        try {
          // Crear documento de usuario en Firestore
          const nuevoUsuario: any = {
            nombre: datosRegistro.nombre,
            email: datosRegistro.email,
            telefono: datosRegistro.telefono,
            ciudad: datosRegistro.ciudad,
            fechaRegistro: serverTimestamp(),
            calificacion: 5,
            biografia: '',
            trueques_realizados: 0,
            trueques_pendientes: 0,
            recompensas: 0,
            insignias: [],
            verificado: false,
            ultima_actualizacion_perfil: serverTimestamp(),
            rol: 'user'
          };

          const userDocRef = doc(this.firestore, 'usuarios', userCredential.user.uid);

          console.log('💾 Guardando datos en Firestore...');
          console.log('📍 Ruta del documento:', `usuarios/${userCredential.user.uid}`);
          console.log('📦 Datos a guardar:', nuevoUsuario);

          await setDoc(userDocRef, nuevoUsuario);

          console.log('✅ Datos guardados en Firestore correctamente');

          // Actualizar el perfil de Firebase Auth
          console.log('👤 Actualizando perfil de autenticación...');
          await updateProfile(userCredential.user, {
            displayName: datosRegistro.nombre
          });

          // Verificar que el documento se guardó correctamente
          console.log('🔍 Verificando creación del documento...');
          const verificarDoc = await getDoc(userDocRef);
          if (!verificarDoc.exists()) {
            throw new Error('Error al verificar creación de usuario en Firestore');
          }

          console.log('✅ Registro completado exitosamente');
          return {
            exito: true,
            mensaje: 'Registro exitoso'
          };
        } catch (firestoreError: any) {
          // Si falla Firestore, eliminar el usuario de Auth para evitar usuarios huérfanos
          console.error('❌ Error al guardar en Firestore:', firestoreError);
          console.error('🔍 Código de error:', firestoreError.code);
          console.error('🔍 Mensaje de error:', firestoreError.message);
          console.error('🔍 Error completo:', firestoreError);

          console.log('🗑️ Intentando eliminar usuario de Firebase Auth para evitar usuarios huérfanos...');
          try {
            await userCredential.user.delete();
            console.log('✅ Usuario eliminado de Firebase Auth');
          } catch (deleteError) {
            console.error('⚠️ No se pudo eliminar el usuario de Auth:', deleteError);
          }

          throw firestoreError; // Re-lanzar el error para que sea capturado por catchError
        }
      }),
      catchError((error: any) => {
        console.error('❌ Error en el proceso de registro:', error);
        console.error('🔍 Código completo del error:', error.code);
        console.error('🔍 Mensaje completo del error:', error.message);
        console.error('🔍 Stack trace:', error.stack);

        let mensaje = 'Error al registrar usuario';
        let detalleError = error.message || 'Error desconocido';

        // Errores de autenticación
        if (error.code === 'auth/email-already-in-use') {
          mensaje = 'El email ya está registrado';
          detalleError = 'Este correo electrónico ya tiene una cuenta asociada. Ve a Firebase Console → Authentication → Users y elimina el usuario si es necesario.';
        } else if (error.code === 'auth/weak-password') {
          mensaje = 'La contraseña es muy débil';
          detalleError = 'La contraseña debe tener al menos 6 caracteres';
        } else if (error.code === 'auth/invalid-email') {
          mensaje = 'El email no es válido';
          detalleError = 'Verifica que el correo electrónico esté bien escrito';
        }
        // Errores de Firestore
        else if (error.code === 'permission-denied') {
          mensaje = 'Error de permisos en la base de datos';
          detalleError = 'Las reglas de Firestore están bloqueando el acceso. Las reglas deben permitir escritura.';
        } else if (error.code === 'unavailable' || error.message?.includes('offline')) {
          mensaje = 'Base de datos no disponible';
          detalleError = 'Firestore Database no responde. Verifica tu conexión a internet y que Firestore esté creado en Firebase Console.';
        } else if (error.code === 'failed-precondition') {
          mensaje = 'Error de configuración de Firestore';
          detalleError = 'Firestore Database no está correctamente configurado. Verifica que esté creado en modo "production" en Firebase Console → Build → Firestore Database.';
        }

        console.error(`💥 ${mensaje}: ${detalleError}`);

        return of({
          exito: false,
          mensaje,
          detalleError
        });
      })
    );
  }

  /**
   * Iniciar sesión
   */
  login(email: string, contrasena: string): Observable<{exito: boolean, mensaje: string}> {
    return from(
      signInWithEmailAndPassword(this.auth, email, contrasena)
    ).pipe(
      switchMap(async (userCredential) => {
        // Generar token de sesión único
        this.sesionTokenLocal = this.generarTokenSesion();
        console.log(`🔑 Token de sesión generado: ${this.sesionTokenLocal.substring(0, 10)}...`);

        // Guardar token de sesión en Firestore
        const userDocRef = doc(this.firestore, 'usuarios', userCredential.user.uid);
        await updateDoc(userDocRef, {
          sesion_activa: this.sesionTokenLocal,
          ultima_actividad: serverTimestamp()
        });

        console.log(`✅ Token de sesión guardado en Firestore`);

        // Iniciar listener de detección de sesión dual
        this.iniciarListenerSesionDual(userCredential.user.uid);

        return {
          exito: true,
          mensaje: 'Login exitoso'
        };
      }),
      catchError((error: any) => {
        let mensaje = 'Error al iniciar sesión';

        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          mensaje = 'Email o contraseña incorrectos';
        } else if (error.code === 'auth/invalid-email') {
          mensaje = 'El email no es válido';
        } else if (error.code === 'auth/user-disabled') {
          mensaje = 'Esta cuenta ha sido deshabilitada';
        }

        return of({
          exito: false,
          mensaje
        });
      })
    );
  }

  /**
   * Obtener usuario actual como Observable
   */
  getUsuarioActual(): Observable<Usuario | null> {
    return this.usuarioActual$.asObservable();
  }

  /**
   * Obtener usuario actual de forma síncrona
   */
  getUsuarioActualSync(): Usuario | null {
    return this.usuarioActual$.value;
  }

  /**
   * Cerrar sesión
   */
  logout(): Observable<void> {
    // Detener listener de sesión dual
    this.detenerListenerSesionDual();

    // Limpiar token de sesión local
    this.sesionTokenLocal = '';
    this.sesionDualDetectada$.next(false);

    return from(signOut(this.auth));
  }

  /**
   * Verificar si el usuario está autenticado
   */
  estaAutenticado(): boolean {
    return this.usuarioActual$.value !== null;
  }

  /**
   * Actualizar datos del perfil
   */
  actualizarPerfil(datosActualizados: any): Observable<RespuestaActualizacion> {
    const usuarioActual = this.usuarioActual$.value;

    if (!usuarioActual) {
      return of({
        exito: false,
        mensaje: 'No hay usuario autenticado'
      });
    }

    const userDocRef = doc(this.firestore, 'usuarios', usuarioActual.id);

    return from(
      updateDoc(userDocRef, {
        ...datosActualizados,
        ultima_actualizacion_perfil: serverTimestamp()
      })
    ).pipe(
      switchMap(async () => {
        // Recargar usuario actualizado
        const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioActual.id);
        if (usuarioActualizado) {
          this.usuarioActual$.next(usuarioActualizado);
        }

        return {
          exito: true,
          mensaje: '✅ Perfil actualizado correctamente',
          usuario: usuarioActualizado || undefined
        };
      }),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al actualizar el perfil'
      }))
    );
  }

  /**
   * Actualizar foto de perfil
   */
  actualizarFoto(fotoDataUrl: string): Observable<RespuestaFoto> {
    const usuarioActual = this.usuarioActual$.value;

    if (!usuarioActual) {
      return of({
        exito: false,
        mensaje: 'No hay usuario autenticado'
      });
    }

    // Verificar si puede cambiar foto
    if (!this.puedeActualizarFoto()) {
      const diasRestantes = this.diasParaActualizarFoto();
      return of({
        exito: false,
        mensaje: `Debes esperar ${diasRestantes} días para cambiar tu foto`
      });
    }

    // Convertir DataURL a Blob
    const blob = this.dataURLtoBlob(fotoDataUrl);
    const fileName = `foto-perfil-${usuarioActual.id}-${Date.now()}.jpg`;
    const storageRef = ref(this.storage, `perfiles/${usuarioActual.id}/${fileName}`);

    return from(uploadBytes(storageRef, blob)).pipe(
      switchMap(() => getDownloadURL(storageRef)),
      switchMap(async (fotoUrl) => {
        // Guardar foto como pendiente en Firestore
        const userDocRef = doc(this.firestore, 'usuarios', usuarioActual.id);
        await updateDoc(userDocRef, {
          foto_pendiente: fotoUrl,
          estado_foto: 'pendiente',
          ultima_actualizacion_foto: serverTimestamp()
        });

        // Recargar usuario actualizado
        const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioActual.id);
        if (usuarioActualizado) {
          this.usuarioActual$.next(usuarioActualizado);
        }

        return {
          exito: true,
          mensaje: '📸 Foto enviada. Está en revisión por el administrador',
          foto_url: fotoUrl
        };
      }),
      catchError((error) => {
        console.error('Error al subir foto:', error);
        return of({
          exito: false,
          mensaje: 'Error al subir la foto'
        });
      })
    );
  }

  /**
   * Convertir DataURL a Blob
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

  /**
   * Verificar si puede actualizar la foto (límite de 30 días)
   */
  puedeActualizarFoto(): boolean {
    const usuario = this.usuarioActual$.value;
    if (!usuario) return false;

    // Si no tiene fecha de última actualización, puede actualizar
    if (!usuario.ultima_actualizacion_foto) return true;

    const ahora = new Date();
    const ultimaActualizacion = new Date(usuario.ultima_actualizacion_foto);
    const diasTranscurridos = (ahora.getTime() - ultimaActualizacion.getTime()) / (1000 * 60 * 60 * 24);

    return diasTranscurridos >= this.DIAS_LIMITE_FOTO;
  }

  /**
   * Días restantes para poder actualizar la foto
   */
  diasParaActualizarFoto(): number {
    const usuario = this.usuarioActual$.value;
    if (!usuario || !usuario.ultima_actualizacion_foto) return 0;

    const ahora = new Date();
    const ultimaActualizacion = new Date(usuario.ultima_actualizacion_foto);
    const diasTranscurridos = (ahora.getTime() - ultimaActualizacion.getTime()) / (1000 * 60 * 60 * 24);

    const diasRestantes = Math.ceil(this.DIAS_LIMITE_FOTO - diasTranscurridos);
    return diasRestantes > 0 ? diasRestantes : 0;
  }

  /**
   * Agregar recompensas al usuario
   */
  async agregarRecompensa(cantidad: number = 1): Promise<void> {
    const usuarioActual = this.usuarioActual$.value;
    if (!usuarioActual) return;

    const userDocRef = doc(this.firestore, 'usuarios', usuarioActual.id);
    await updateDoc(userDocRef, {
      recompensas: usuarioActual.recompensas + cantidad
    });

    // Recargar usuario
    const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioActual.id);
    if (usuarioActualizado) {
      this.usuarioActual$.next(usuarioActualizado);
    }
  }

  /**
   * Incrementar contador de trueques realizados
   */
  async incrementarTruequeRealizados(): Promise<void> {
    const usuarioActual = this.usuarioActual$.value;
    if (!usuarioActual) return;

    const userDocRef = doc(this.firestore, 'usuarios', usuarioActual.id);
    await updateDoc(userDocRef, {
      trueques_realizados: usuarioActual.trueques_realizados + 1
    });

    // Recargar usuario
    const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioActual.id);
    if (usuarioActualizado) {
      this.usuarioActual$.next(usuarioActualizado);
    }
  }

  /**
   * Agregar insignia al usuario
   */
  async agregarInsignia(insigniaId: string): Promise<void> {
    const usuarioActual = this.usuarioActual$.value;
    if (!usuarioActual || usuarioActual.insignias.includes(insigniaId)) return;

    const userDocRef = doc(this.firestore, 'usuarios', usuarioActual.id);
    await updateDoc(userDocRef, {
      insignias: [...usuarioActual.insignias, insigniaId]
    });

    // Recargar usuario
    const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioActual.id);
    if (usuarioActualizado) {
      this.usuarioActual$.next(usuarioActualizado);
    }
  }

  /**
   * Verificar usuario
   */
  async verificarUsuario(): Promise<void> {
    const usuarioActual = this.usuarioActual$.value;
    if (!usuarioActual) return;

    const userDocRef = doc(this.firestore, 'usuarios', usuarioActual.id);
    await updateDoc(userDocRef, {
      verificado: true
    });

    // Recargar usuario
    const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioActual.id);
    if (usuarioActualizado) {
      this.usuarioActual$.next(usuarioActualizado);
    }
  }

  /**
   * Actualizar calificación del usuario
   */
  async actualizarCalificacion(nuevaCalificacion: number): Promise<void> {
    const usuarioActual = this.usuarioActual$.value;
    if (!usuarioActual) return;

    const userDocRef = doc(this.firestore, 'usuarios', usuarioActual.id);
    await updateDoc(userDocRef, {
      calificacion: nuevaCalificacion
    });

    // Recargar usuario
    const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioActual.id);
    if (usuarioActualizado) {
      this.usuarioActual$.next(usuarioActualizado);
    }
  }

  /**
   * Obtener todos los usuarios (para admin)
   */
  async obtenerTodosUsuarios(): Promise<Usuario[]> {
    try {
      const usuariosSnapshot = await getDocs(collection(this.firestore, 'usuarios'));
      return usuariosSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        fechaRegistro: doc.data()['fechaRegistro']?.toDate?.() || new Date(),
        ultima_actualizacion_foto: doc.data()['ultima_actualizacion_foto']?.toDate?.() || undefined,
        ultima_actualizacion_perfil: doc.data()['ultima_actualizacion_perfil']?.toDate?.() || new Date()
      })) as Usuario[];
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return [];
    }
  }

  /**
   * Verificar si el usuario actual es administrador
   */
  esAdmin(): boolean {
    const usuario = this.usuarioActual$.value;
    return usuario?.rol === 'admin';
  }

  /**
   * Verificar si el usuario actual es admin o es el propietario del recurso
   */
  esAdminOPropietario(usuarioId: string): boolean {
    const usuario = this.usuarioActual$.value;
    if (!usuario) return false;
    return usuario.rol === 'admin' || usuario.id === usuarioId;
  }

  /**
   * Obtener usuarios con fotos pendientes de aprobación (solo admin)
   */
  async obtenerUsuariosConFotosPendientes(): Promise<Usuario[]> {
    if (!this.esAdmin()) return [];

    try {
      const fotosQuery = query(
        collection(this.firestore, 'usuarios'),
        where('estado_foto', '==', 'pendiente')
      );
      const snapshot = await getDocs(fotosQuery);

      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        fechaRegistro: doc.data()['fechaRegistro']?.toDate?.() || new Date(),
        ultima_actualizacion_foto: doc.data()['ultima_actualizacion_foto']?.toDate?.() || undefined,
        ultima_actualizacion_perfil: doc.data()['ultima_actualizacion_perfil']?.toDate?.() || new Date()
      })) as Usuario[];
    } catch (error) {
      console.error('Error al obtener fotos pendientes:', error);
      return [];
    }
  }

  /**
   * Aprobar foto de usuario (solo admin)
   */
  aprobarFoto(usuarioId: string): Observable<{exito: boolean, mensaje: string}> {
    if (!this.esAdmin()) {
      return of({
        exito: false,
        mensaje: 'No tienes permisos para esta acción'
      });
    }

    const userDocRef = doc(this.firestore, 'usuarios', usuarioId);

    return from(getDoc(userDocRef)).pipe(
      switchMap(async (userDoc) => {
        if (!userDoc.exists()) {
          return {
            exito: false,
            mensaje: 'Usuario no encontrado'
          };
        }

        const userData = userDoc.data();
        if (!userData['foto_pendiente']) {
          return {
            exito: false,
            mensaje: 'No hay foto pendiente para este usuario'
          };
        }

        // Aprobar la foto
        await updateDoc(userDocRef, {
          foto: userData['foto_pendiente'],
          estado_foto: 'aprobada',
          foto_pendiente: null
        });

        // Si el usuario aprobado es el actual, actualizar sesión
        if (this.usuarioActual$.value?.id === usuarioId) {
          const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioId);
          if (usuarioActualizado) {
            this.usuarioActual$.next(usuarioActualizado);
          }
        }

        return {
          exito: true,
          mensaje: '✅ Foto aprobada correctamente'
        };
      }),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al aprobar la foto'
      }))
    );
  }

  /**
   * Rechazar foto de usuario (solo admin)
   */
  rechazarFoto(usuarioId: string, motivo?: string): Observable<{exito: boolean, mensaje: string}> {
    if (!this.esAdmin()) {
      return of({
        exito: false,
        mensaje: 'No tienes permisos para esta acción'
      });
    }

    const userDocRef = doc(this.firestore, 'usuarios', usuarioId);

    return from(getDoc(userDocRef)).pipe(
      switchMap(async (userDoc) => {
        if (!userDoc.exists()) {
          return {
            exito: false,
            mensaje: 'Usuario no encontrado'
          };
        }

        const userData = userDoc.data();
        if (!userData['foto_pendiente']) {
          return {
            exito: false,
            mensaje: 'No hay foto pendiente para este usuario'
          };
        }

        // Eliminar la foto pendiente de Storage
        try {
          const fotoRef = ref(this.storage, userData['foto_pendiente']);
          await deleteObject(fotoRef);
        } catch (error) {
          console.log('Error al eliminar foto de storage (puede ya no existir):', error);
        }

        // Rechazar la foto
        await updateDoc(userDocRef, {
          estado_foto: 'rechazada',
          foto_pendiente: null,
          ultima_actualizacion_foto: null // Permitir subir de nuevo
        });

        // Si el usuario rechazado es el actual, actualizar sesión
        if (this.usuarioActual$.value?.id === usuarioId) {
          const usuarioActualizado = await this.cargarUsuarioDeFirestore(usuarioId);
          if (usuarioActualizado) {
            this.usuarioActual$.next(usuarioActualizado);
          }
        }

        return {
          exito: true,
          mensaje: motivo ? `❌ Foto rechazada: ${motivo}` : '❌ Foto rechazada'
        };
      }),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al rechazar la foto'
      }))
    );
  }

  /**
   * Obtener usuario por ID (solo admin)
   */
  async obtenerUsuarioPorId(id: string): Promise<Usuario | undefined> {
    if (!this.esAdmin()) {
      console.warn('Acceso denegado: Solo administradores pueden ver otros usuarios');
      return undefined;
    }

    return await this.cargarUsuarioDeFirestore(id) || undefined;
  }

  /**
   * Eliminar usuario (solo admin)
   */
  async eliminarUsuario(usuarioId: string): Promise<void> {
    if (!this.esAdmin()) {
      throw new Error('Acceso denegado: Solo administradores pueden eliminar usuarios');
    }

    const usuarioAEliminar = await this.cargarUsuarioDeFirestore(usuarioId);

    if (!usuarioAEliminar) {
      throw new Error('Usuario no encontrado');
    }

    if (usuarioAEliminar.rol === 'admin') {
      throw new Error('No se puede eliminar usuarios administradores');
    }

    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual?.id === usuarioId) {
      throw new Error('No puedes eliminar tu propia cuenta');
    }

    try {
      // Eliminar usuario de Firestore
      await deleteDoc(doc(this.firestore, 'usuarios', usuarioId));

      // Limpiar datos relacionados
      await this.limpiarDatosRelacionados(usuarioId);

      console.log(`✅ Usuario ${usuarioId} eliminado correctamente`);
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      throw new Error('Error al eliminar el usuario');
    }
  }

  /**
   * Limpiar datos relacionados con un usuario eliminado
   */
  private async limpiarDatosRelacionados(usuarioId: string): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);

      // 1. Eliminar artículos del usuario
      const articulosQuery = query(
        collection(this.firestore, 'articulos'),
        where('usuarioId', '==', usuarioId)
      );
      const articulosSnapshot = await getDocs(articulosQuery);
      articulosSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 2. Eliminar conversaciones donde participa
      const conversacionesQuery = query(
        collection(this.firestore, 'conversaciones'),
        where('participantes', 'array-contains', usuarioId)
      );
      const conversacionesSnapshot = await getDocs(conversacionesQuery);
      conversacionesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 3. Eliminar mensajes del usuario
      const mensajesQuery1 = query(
        collection(this.firestore, 'mensajes'),
        where('emisorId', '==', usuarioId)
      );
      const mensajesSnapshot1 = await getDocs(mensajesQuery1);
      mensajesSnapshot1.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      const mensajesQuery2 = query(
        collection(this.firestore, 'mensajes'),
        where('receptorId', '==', usuarioId)
      );
      const mensajesSnapshot2 = await getDocs(mensajesQuery2);
      mensajesSnapshot2.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 4. Eliminar transacciones de puntos
      const transaccionesQuery = query(
        collection(this.firestore, 'transacciones_puntos'),
        where('usuarioId', '==', usuarioId)
      );
      const transaccionesSnapshot = await getDocs(transaccionesQuery);
      transaccionesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 5. Eliminar vouchers canjeados
      const vouchersQuery = query(
        collection(this.firestore, 'vouchers_canjeados'),
        where('usuarioId', '==', usuarioId)
      );
      const vouchersSnapshot = await getDocs(vouchersQuery);
      vouchersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Ejecutar todas las eliminaciones
      await batch.commit();

      console.log(`✅ Datos relacionados del usuario ${usuarioId} eliminados`);
    } catch (error) {
      console.error('Error al limpiar datos relacionados:', error);
    }
  }

  /**
   * Contar artículos de un usuario
   */
  async contarArticulosUsuario(usuarioId: string): Promise<number> {
    try {
      const articulosQuery = query(
        collection(this.firestore, 'articulos'),
        where('usuarioId', '==', usuarioId)
      );
      const snapshot = await getDocs(articulosQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error al contar artículos:', error);
      return 0;
    }
  }

  /**
   * Generar token de sesión único
   */
  private generarTokenSesion(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  /**
   * Iniciar listener para detectar sesión dual
   */
  private iniciarListenerSesionDual(userId: string) {
    console.log(`👀 Iniciando listener de sesión dual para usuario ${userId}...`);

    // Detener listener anterior si existe
    if (this.sesionListener) {
      this.sesionListener();
      this.sesionListener = null;
    }

    const userDocRef = doc(this.firestore, 'usuarios', userId);

    this.sesionListener = onSnapshot(userDocRef, (docSnapshot) => {
      if (!docSnapshot.exists()) return;

      const data = docSnapshot.data();
      const sesionActivaFirestore = data['sesion_activa'];

      // Verificar si el token de sesión cambió
      if (sesionActivaFirestore && sesionActivaFirestore !== this.sesionTokenLocal) {
        console.log('🚨 SESIÓN DUAL DETECTADA');
        console.log(`   Token local: ${this.sesionTokenLocal.substring(0, 10)}...`);
        console.log(`   Token Firestore: ${sesionActivaFirestore.substring(0, 10)}...`);

        this.ngZone.run(() => {
          this.sesionDualDetectada$.next(true);
        });
      }
    }, (error) => {
      console.error('❌ Error en listener de sesión dual:', error);
    });
  }

  /**
   * Detener listener de sesión dual
   */
  private detenerListenerSesionDual() {
    if (this.sesionListener) {
      console.log('🛑 Deteniendo listener de sesión dual...');
      this.sesionListener();
      this.sesionListener = null;
    }
  }

  /**
   * Obtener observable de sesión dual detectada
   */
  getSesionDualDetectada(): Observable<boolean> {
    return this.sesionDualDetectada$.asObservable();
  }

  /**
   * Actualizar calificación promedio de un usuario
   */
  async actualizarCalificacionUsuario(usuarioId: string, calificacion: number): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'usuarios', usuarioId);
      await updateDoc(userDocRef, {
        calificacion: Number(calificacion.toFixed(1))
      });
      console.log(`✅ Calificación de usuario ${usuarioId} actualizada a ${calificacion.toFixed(1)}`);
    } catch (error) {
      console.error('Error al actualizar calificación:', error);
      throw error;
    }
  }
}
