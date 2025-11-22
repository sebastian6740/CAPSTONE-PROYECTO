import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.esAdmin()) {
    return true;
  } else {
    console.warn('Acceso denegado: Se requieren permisos de administrador');
    router.navigate(['/home']);
    return false;
  }
};
