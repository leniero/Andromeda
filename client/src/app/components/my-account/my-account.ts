import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth';
import { EmotionService, EmotionData } from '../../services/emotion';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './my-account.html',
  styleUrls: ['./my-account.css']
})
export class MyAccountComponent implements OnInit {
  user: any = null;
  error: string = '';
  isEditing: boolean = false;
  editUsername: string = '';
  editEmail: string = '';
  updateError: string = '';
  updateSuccess: string = '';
  lastEmotion: EmotionData | null = null;
  
  getEmotionColor(emotion: string): string {
    return this.emotionService.getEmotionColor(emotion);
  }

  onBackgroundClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.router.navigate(['/home']);
    }
  }

  emotionEmojis: { [key: string]: string } = {
    Anger: '😡', Contempt: '😒', Disgust: '🤢', Envy: '😐',
    Guilt: '😣', Shame: '😳', Fear: '😨', Sadness: '😢',
    Surprise: '😲', Interest: '🧐', Hope: '🙂', Relief: '😮‍💨',
    Satisfaction: '😊', Joy: '😆', Elation: '😌', Pride: '🥹'
  };

  private authService = inject(AuthService);
  private emotionService = inject(EmotionService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.user = user;
        this.error = '';
        this.emotionService.getUserEmotions().subscribe({
          next: (emotions) => {
            if (emotions && emotions.length > 0) {
              this.lastEmotion = emotions[0]; // Assuming they are sorted by date desc
            }
            this.cdr.detectChanges();
          }
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status !== 401) {
           console.warn('Failed to load profile', err);
        }
        this.error = 'Please try logging in again.';
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editUsername = this.user.username;
      this.editEmail = this.user.email;
      this.updateError = '';
      this.updateSuccess = '';
    }
  }

  updateProfile() {
    this.updateError = '';
    this.updateSuccess = '';
    
    if (!this.editUsername || !this.editEmail) {
      this.updateError = 'Username and email cannot be empty.';
      return;
    }

    let cleanUsername = this.editUsername.trim();
    if (cleanUsername.startsWith('@')) {
      cleanUsername = cleanUsername.substring(1);
    }
    this.editUsername = cleanUsername; // Update the input field instantly to reflect stripped @

    const data = { username: cleanUsername, email: this.editEmail.trim() };
    this.authService.updateUser(this.user._id, data).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        this.isEditing = false;
        this.updateSuccess = 'Profile updated successfully.';
        this.cdr.detectChanges();
        setTimeout(() => this.updateSuccess = '', 3000);
      },
      error: (err) => {
        this.updateError = err.error?.error || 'Failed to update profile.';
        this.cdr.detectChanges();
      }
    });
  }

  isDeleting: boolean = false;

  confirmDelete() {
    this.isDeleting = true;
  }

  cancelDelete() {
    this.isDeleting = false;
  }

  deleteAccount() {
    this.authService.deleteUser(this.user._id).subscribe({
      next: () => {
        this.logout();
      },
      error: (err) => {
        this.error = 'Failed to delete account.';
        this.isDeleting = false;
        this.cdr.detectChanges();
      }
    });
  }
}
