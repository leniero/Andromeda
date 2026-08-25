import { Component, ViewChild, ElementRef, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmotionSpheresComponent } from '../emotion-spheres/emotion-spheres';
import { EmotionFormComponent } from '../emotion-form/emotion-form';
import { AuthService } from '../../services/auth';
import { EmotionData } from '../../services/emotion';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, EmotionSpheresComponent, EmotionFormComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  @ViewChild(EmotionSpheresComponent) spheresComponent!: EmotionSpheresComponent;
  @ViewChild('fabContainer') fabContainer!: ElementRef;
  showText = true;
  isFormVisible = false;
  isSuccessToastVisible = false;
  isZoomed = false;
  viewMode: 'world' | 'me' = 'world';
  authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  onEmotionSelected(isZoomed: boolean) {
    this.isZoomed = isZoomed;
  }

  onEmotionLogStarted() {
    this.isSuccessToastVisible = true;
  }

  onEmotionLogged(emotion: EmotionData) {
    // Allow the 3D physics sphere to spawn immediately, but delay removing the DOM form for 600ms so it can fade out visually.
    setTimeout(() => {
      this.isFormVisible = false;
      this.cdr.detectChanges();
    }, 600);
    
    // Hide toast after a few seconds
    setTimeout(() => {
      this.isSuccessToastVisible = false;
      this.cdr.detectChanges();
    }, 4000);
    if (this.spheresComponent) {
      this.spheresComponent.addSpawnedSphere(emotion);
    }
  }

  toggleText() {
    this.showText = !this.showText;
  }

  toggleForm() {
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
    if (this.isFormVisible && this.fabContainer && !this.fabContainer.nativeElement.contains(event.target)) {
      this.isFormVisible = false;
    }
  }
}
