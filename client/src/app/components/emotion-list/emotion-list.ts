import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { EmotionService, EmotionData } from '../../services/emotion';
import { AuthService } from '../../services/auth';
import { LocationService } from '../../services/location';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emotion-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './emotion-list.html',
  styleUrls: ['./emotion-list.css']
})
export class EmotionListComponent implements OnInit {
  emotions: EmotionData[] = [];
  currentUser: any = null;
  deletingId: string | null = null;
  deleteSuccess: boolean = false;
  isLoading: boolean = true;
  private emotionService = inject(EmotionService);
  private authService = inject(AuthService);
  private locationService = inject(LocationService);
  private cdr = inject(ChangeDetectorRef);

  getEmotionColor(emotion: string): string {
    return this.emotionService.getEmotionColor(emotion);
  }

  emotionEmojis: { [key: string]: string } = {
    Anger: '😡', Contempt: '😒', Disgust: '🤢', Envy: '😐',
    Guilt: '😣', Shame: '😳', Fear: '😨', Sadness: '😢',
    Surprise: '😲', Interest: '🧐', Hope: '🙂', Relief: '😮‍💨',
    Satisfaction: '😊', Joy: '😆', Elation: '😌', Pride: '🥹'
  };

  formatDate(dateString: string): string {
    const d = new Date(dateString);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  getOrbitText(emotion: string): string {
    const word = emotion.toUpperCase() + ' • ';
    if (word.length > 10) return word.repeat(2);
    if (word.length > 6) return word.repeat(3);
    return word.repeat(4);
  }

  ngOnInit() {
    this.emotionService.getUserEmotions().subscribe({
      next: async (data) => {
        this.emotions = data;
        this.isLoading = false;
        
        try {
          const loc = await this.locationService.getLocation();
          this.emotions.forEach(emotion => {
            if (emotion.latitude && emotion.longitude) {
              (emotion as any).distance = this.locationService.calculateDistance(
                loc.latitude, loc.longitude,
                emotion.latitude, emotion.longitude
              );
            }
          });
          this.cdr.detectChanges();
        } catch (err) {
          console.error("Location not available for distance calculation", err);
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error("Failed to load emotions", err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });

    if (this.authService.isLoggedIn()) {
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUser = user;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.warn('Could not fetch user profile, they might need to login again.');
        }
      });
    }
  }

  confirmDelete(id: string | undefined) {
    if (id) {
      this.deletingId = id;
    }
  }

  cancelDelete() {
    this.deletingId = null;
  }

  deleteEntry(id: string | undefined) {
    if (!id) return;
    this.emotionService.deleteEmotion(id).subscribe({
      next: () => {
        this.emotions = this.emotions.filter(e => e._id !== id);
        this.emotionService.notifyEmotionDeleted(id);
        this.deletingId = null;
        this.deleteSuccess = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.deleteSuccess = false;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => console.error('Failed to delete entry', err)
    });
  }
}
