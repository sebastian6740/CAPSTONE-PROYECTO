import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro.component').then(m => m.RegistroComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.page').then(m => m.TabsPage)
  },
  {
    path: 'perfil',
    loadComponent: () => import('./pages/perfil/perfil.component').then(m => m.PerfilComponent)
  },
  {
    path: 'recompensas',
    loadComponent: () => import('./pages/recompensas/recompensas.component').then(m => m.RecompensasComponent)
  },
  {
    path: 'publicar-articulo',
    loadComponent: () => import('./pages/publicar-articulo/publicar-articulo.component').then(m => m.PublicarArticuloComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [() => inject(AuthService).esAdmin() || (inject(Router).navigate(['/home']), false)]
  },
  {
    path: 'detalle-articulo/:id',
    loadComponent: () => import('./pages/detalle-articulo/detalle-articulo.component').then(m => m.DetalleArticuloComponent)
  },
  {
    path: 'mensajes',
    loadComponent: () => import('./pages/mensajes/mensajes.component').then(m => m.MensajesComponent)
  },
  {
    path: 'chat/:conversacionId',
    loadComponent: () => import('./pages/chat/chat.component').then(m => m.ChatComponent)
  },
  {
    path: 'mis-trueques',
    loadComponent: () => import('./pages/mis-trueques/mis-trueques.component').then(m => m.MisTruequesComponent)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];