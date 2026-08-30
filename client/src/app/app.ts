import { Component, signal, OnInit, inject, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

import { NavbarComponent } from './components/navbar/navbar';
import { LocationService } from './services/location';
import { EmotionSpheresComponent } from './components/emotion-spheres/emotion-spheres';
import { EmotionFormComponent } from './components/emotion-form/emotion-form';
import { AuthService } from './services/auth';
import { EmotionData } from './services/emotion';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CommonModule, EmotionSpheresComponent, EmotionFormComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('client');
  private locationService = inject(LocationService);
  authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  @ViewChild(EmotionSpheresComponent) spheresComponent!: EmotionSpheresComponent;
  @ViewChild('fabContainer') fabContainer!: ElementRef;

  showText = true;
  isFormVisible = false;
  isSuccessToastVisible = false;
  isZoomed = false;
  viewMode: 'world' | 'me' = 'world';
  currentTheme: 'dark' | 'light' = 'dark';

  isWelcomeRoute = false;
  isAuthRoute = false;
  isListRoute = false;
  isAccountRoute = false;

  ngOnInit() {
    this.locationService.getLocation().catch(err => console.warn(err));
    
    this.currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects;
      this.isWelcomeRoute = url === '/';
      this.isAuthRoute = url.includes('/login') || url.includes('/signup') || url.includes('/forgot') || url.includes('/reset') || url.includes('/verify');
      this.isListRoute = url.includes('/emotion-list');
      this.isAccountRoute = url.includes('/my-account') || url.includes('/change-password');
      
      // When navigating to overlay routes, close any zoomed sphere view
      if ((this.isListRoute || this.isAccountRoute || this.isAuthRoute || this.isWelcomeRoute) && this.spheresComponent) {
        this.spheresComponent.closeDetail();
        this.isZoomed = false;
        this.isFormVisible = false;
      }
    });
  }

  onEmotionSelected(isZoomed: boolean) {
    this.isZoomed = isZoomed;
  }

  onEmotionLogStarted() {
    this.isSuccessToastVisible = true;
  }

  onEmotionLogged(emotion: EmotionData) {
    setTimeout(() => {
      this.isFormVisible = false;
      this.cdr.detectChanges();
    }, 600);
    
    setTimeout(() => {
      this.isSuccessToastVisible = false;
      this.cdr.detectChanges();
    }, 4000);

    if (this.spheresComponent) {
      if (emotion.isPublic === false && this.viewMode === 'world') {
        // Do not show private emotions in the world view
      } else {
        this.spheresComponent.addSpawnedSphere(emotion);
      }
    }
  }

  toggleText() {
    this.showText = !this.showText;
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
  }

  toggleForm() {
    if (this.isListRoute || this.isAccountRoute) {
      this.router.navigate(['/home']);
      return;
    }
    
    this.isFormVisible = !this.isFormVisible;
    
    if (this.isFormVisible && this.spheresComponent) {
      this.spheresComponent.closeDetail();
    }
  }

  setViewMode(mode: 'world' | 'me') {
    this.viewMode = mode;
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentClick(event: Event) {
    if (this.isFormVisible && this.fabContainer && !this.fabContainer.nativeElement.contains(event.target as Node)) {
      this.isFormVisible = false;
    }
  }

  dismissOverlay() {
    this.router.navigate(['/home']);
  }

  onMainClick(event: Event) {
    if (event.target === event.currentTarget && (this.isListRoute || this.isAccountRoute || this.isAuthRoute || this.isWelcomeRoute)) {
      this.dismissOverlay();
    }
  }
}
