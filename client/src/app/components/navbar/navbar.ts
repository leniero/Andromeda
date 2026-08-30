import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class NavbarComponent {
  authService = inject(AuthService);
  router = inject(Router);

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  get isHiddenAuthPage(): boolean {
    const hiddenRoutes = ['/', '/login', '/signup', '/forgot-password'];
    // Check if the route is strictly one of the hidden routes, or starts with reset-password/verify-email
    return hiddenRoutes.includes(this.router.url) || 
           this.router.url.startsWith('/reset-password') || 
           this.router.url.startsWith('/verify-email');
  }

  get isHomeRoute(): boolean {
    return this.router.url === '/home' || this.router.url === '/';
  }
}
