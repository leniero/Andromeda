import { Component, inject, Output, EventEmitter, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmotionService, EmotionData } from '../../services/emotion';
import { LocationService } from '../../services/location';
import { AuthService } from '../../services/auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emotion-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './emotion-form.html',
  styleUrls: ['./emotion-form.css']
})
export class EmotionFormComponent implements OnInit {
  @Output() emotionLogged = new EventEmitter<EmotionData>();
  @Output() emotionLogStarted = new EventEmitter<void>();
  @ViewChild('formElement') formElement!: ElementRef;
  emotionForm: FormGroup;
  isSubmitting = false;
  private fb = inject(FormBuilder);
  private emotionService = inject(EmotionService);
  private locationService = inject(LocationService);
  private cdr = inject(ChangeDetectorRef);
  authService = inject(AuthService);

  emotions = ['Anger', 'Contempt', 'Disgust', 'Envy', 'Guilt', 'Shame', 'Fear', 'Sadness', 'Surprise', 'Interest', 'Hope', 'Relief', 'Satisfaction', 'Joy', 'Elation', 'Pride'];

  emotionEmojis: { [key: string]: string } = {
    Anger: '😡', Contempt: '😒', Disgust: '🤢', Envy: '😐',
    Guilt: '😣', Shame: '😳', Fear: '😨', Sadness: '😢',
    Surprise: '😲', Interest: '🧐', Hope: '🙂', Relief: '😮‍💨',
    Satisfaction: '😊', Joy: '😆', Elation: '😌', Pride: '🥹'
  };

  emotionColors: { [key: string]: string } = {
    Anger: 'rgba(255, 0, 0, 0.7)', Contempt: 'rgba(255, 69, 0, 0.7)', Disgust: 'rgba(255, 140, 0, 0.7)', Envy: 'rgba(255, 215, 0, 0.7)',
    Guilt: 'rgba(255, 255, 0, 0.7)', Shame: 'rgba(154, 205, 50, 0.7)', Fear: 'rgba(0, 128, 0, 0.7)', Sadness: 'rgba(32, 178, 170, 0.7)',
    Surprise: 'rgba(135, 206, 235, 0.7)', Interest: 'rgba(0, 191, 255, 0.7)', Hope: 'rgba(30, 144, 255, 0.7)',
    Relief: 'rgba(0, 0, 255, 0.7)', Satisfaction: 'rgba(106, 90, 205, 0.7)', Joy: 'rgba(123, 104, 238, 0.7)', Elation: 'rgba(186, 85, 211, 0.7)',
    Pride: 'rgba(148, 0, 211, 0.7)'
  };

  get selectedEmotion() { return this.emotionForm.get('emotion')?.value; }
  get selectedColor() { return this.selectedEmotion ? this.emotionColors[this.selectedEmotion] : ''; }

  successMessage = '';
  morphState: 'idle' | 'morphing' | 'floating' = 'idle';
  randomDelay = '0s';

  constructor() {
    this.randomDelay = `-${Math.random() * 4}s`;
    this.emotionForm = this.fb.group({
      emotion: ['', Validators.required],
      reason: ['', [Validators.required, Validators.maxLength(150)]],
      latitude: [0, Validators.required],
      longitude: [0, Validators.required],
      isPublic: [true]
    });
  }

  ngOnInit() {
    this.locationService.getLocation().then(loc => {
      this.emotionForm.patchValue({
        latitude: loc.latitude,
        longitude: loc.longitude
      });
    });
  }

  onSubmit() {
    if (this.emotionForm.valid) {
      this.isSubmitting = true;
      const formData: EmotionData = {
        ...this.emotionForm.value,
        text_input: this.emotionForm.value.reason // map reason to text_input for backend
      };
      
      // Freeze the form's dimensions so CSS can smoothly animate them down
      if (this.formElement) {
        const rect = this.formElement.nativeElement.getBoundingClientRect();
        this.formElement.nativeElement.style.setProperty('--start-width', `${rect.width}px`);
        this.formElement.nativeElement.style.setProperty('--start-height', `${rect.height}px`);
      }
      
      this.emotionService.logEmotion(formData).subscribe({
        next: (res) => {
          const spawnedEmotion: EmotionData = {
            ...formData,
            local_time: new Date().toISOString(),
            _id: Math.random().toString(36).substr(2, 9)
          };
          
          this.isSubmitting = false;
          this.successMessage = 'Logged Successfully!';
          
          // Force angular to apply the 'morphing' class IMMEDIATELY
          this.morphState = 'morphing';
          if (this.cdr) this.cdr.detectChanges();
          
          // 1. Wait 600ms for the CSS transition to circle to complete
          setTimeout(() => {
            // 2. Hold the perfect circle shape for 2 seconds
            setTimeout(() => {
              this.morphState = 'floating';
              this.emotionLogStarted.emit();
              
              // Spawn the 3D sphere IMMEDIATELY as the DOM element starts to fade out
              this.emotionLogged.emit(spawnedEmotion);
              
              if (this.cdr) this.cdr.detectChanges();
               
              // 3. Wait 600ms for it to fade out before resetting
              setTimeout(() => {
                this.emotionForm.reset();
                this.morphState = 'idle';
                this.successMessage = '';
                if (this.formElement) {
                  this.formElement.nativeElement.style.removeProperty('--start-width');
                  this.formElement.nativeElement.style.removeProperty('--start-height');
                }
                if (this.cdr) this.cdr.detectChanges();
              }, 600);
            }, 2000);
          }, 600);
        },
        error: (err) => {
          console.error('Submission failed', err);
          this.isSubmitting = false;
        }
      });
    }
  }
}
