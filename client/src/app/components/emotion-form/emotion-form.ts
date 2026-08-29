import { Component, inject, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, Input } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmotionService, EmotionData } from '../../services/emotion';
import { LocationService } from '../../services/location';
import { AuthService } from '../../services/auth';
import { VideoStorageService } from '../../services/video-storage.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emotion-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './emotion-form.html',
  styleUrls: ['./emotion-form.css']
})
export class EmotionFormComponent implements OnInit, OnDestroy {
  @Output() emotionLogged = new EventEmitter<EmotionData>();
  @Output() emotionLogStarted = new EventEmitter<void>();
  @Output() viewModeChanged = new EventEmitter<'world' | 'me'>();
  @Input() initialViewMode: 'world' | 'me' = 'world';
  @ViewChild('formElement') formElement!: ElementRef;
  @ViewChild('cameraPreview') cameraPreview!: ElementRef<HTMLVideoElement>;
  
  emotionForm: FormGroup;
  isSubmitting = false;
  isCameraActive = false;
  isRecording = false;
  facingMode: 'user' | 'environment' = 'environment';
  cameraStream: MediaStream | null = null;
  mediaRecorder: MediaRecorder | null = null;
  videoChunks: Blob[] = [];

  private fb = inject(FormBuilder);
  private emotionService = inject(EmotionService);
  private locationService = inject(LocationService);
  private cdr = inject(ChangeDetectorRef);
  private videoStorageService = inject(VideoStorageService);
  authService = inject(AuthService);

  emotions = ['Anger', 'Contempt', 'Disgust', 'Envy', 'Guilt', 'Shame', 'Fear', 'Sadness', 'Surprise', 'Interest', 'Hope', 'Relief', 'Satisfaction', 'Joy', 'Elation', 'Pride'];

  emotionEmojis: { [key: string]: string } = {
    Anger: '😡', Contempt: '😒', Disgust: '🤢', Envy: '😐',
    Guilt: '😣', Shame: '😳', Fear: '😨', Sadness: '😢',
    Surprise: '😲', Interest: '🧐', Hope: '🙂', Relief: '😮‍💨',
    Satisfaction: '😊', Joy: '😆', Elation: '😌', Pride: '🥹'
  };


  get selectedEmotion() { return this.emotionForm.get('emotion')?.value; }
  get selectedColor() { 
    if (!this.selectedEmotion) return '';
    const hex = this.emotionService.getEmotionColor(this.selectedEmotion);
    return hex + 'b3'; // Append 70% opacity alpha channel
  }

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
    // Set initial toggle state based on input view mode
    if (this.initialViewMode === 'me') {
      this.emotionForm.patchValue({ isPublic: false });
    }

    this.locationService.getLocation().then(loc => {
      this.emotionForm.patchValue({
        latitude: loc.latitude,
        longitude: loc.longitude
      });
    });

    this.emotionForm.get('isPublic')?.valueChanges.subscribe(isPublic => {
      this.viewModeChanged.emit(isPublic ? 'world' : 'me');
    });

    // Request camera permissions when component loads
    this.startCamera();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  private holdTimer: any;
  private holdInterval: any;
  private isHolding = false;
  public recordProgress = 0;

  onPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }
    
    if (event.pointerType === 'touch') {
      // Prevent default touch behaviors like context menus
      // event.preventDefault() can break pointer events on some browsers, so we rely on CSS
    }
    
    if (this.emotionForm.invalid || this.isSubmitting) return;
    
    // Start a timer for hold-to-record
    this.isHolding = true;
    this.holdTimer = setTimeout(() => {
      if (this.isHolding && this.cameraStream) {
        this.isRecording = true;
        this.recordProgress = 0;
        this.cdr.detectChanges(); // Force immediate UI update for camera/progress
        
        const startTime = Date.now();
        const maxTime = 10000;
        
        this.holdInterval = setInterval(() => {
           const elapsed = Date.now() - startTime;
           this.recordProgress = Math.min((elapsed / maxTime) * 100, 100);
           this.cdr.detectChanges(); // Update progress bar
           
           if (elapsed >= maxTime) {
             // Max time reached! Auto stop!
             this.stopRecordingAndSubmit();
           }
        }, 50);

        this.startRecording().then(blob => {
          this.submitData(blob);
        }).catch(err => {
          this.isRecording = false;
          this.cdr.detectChanges();
          this.submitData();
        });
      }
    }, 400); // 400ms hold to trigger video
  }

  private stopRecordingAndSubmit() {
    clearInterval(this.holdInterval);
    this.recordProgress = 0;
    this.isHolding = false;
    
    if (this.isRecording) {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
         this.mediaRecorder.stop();
         // The promise in onPointerDown will catch the stop and call submitData
      }
      this.isRecording = false;
      this.cdr.detectChanges(); // Ensure UI hides progress bar and shows emoji immediately
    }
  }

  onPointerUp(event: PointerEvent) {
    if (this.isSubmitting) return;

    if (this.isHolding && !this.isRecording) {
      // It was a short tap!
      this.isHolding = false;
      clearTimeout(this.holdTimer);
      this.submitData();
    } else if (this.isHolding && this.isRecording) {
      // Released after hold
      this.stopRecordingAndSubmit();
    }
  }

  async startCamera() {
    this.stopCamera(); // Ensure any existing stream is stopped
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode },
        audio: false // No audio needed for this
      });
      if (this.cameraPreview) {
        this.cameraPreview.nativeElement.srcObject = this.cameraStream;
      }
    } catch (err) {
      console.error("Error accessing camera", err);
      this.isCameraActive = false;
    }
  }

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    if (this.cameraPreview && this.cameraPreview.nativeElement) {
      this.cameraPreview.nativeElement.srcObject = null;
    }
  }

  async flipCamera(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (this.isCameraActive) {
      await this.startCamera();
    }
  }

  startRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.cameraStream) return reject("No camera stream");
      
      this.videoChunks = [];
      try {
        this.mediaRecorder = new MediaRecorder(this.cameraStream);
      } catch (e) {
        return reject(e);
      }
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.videoChunks.push(e.data);
      };
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.videoChunks, { type: this.mediaRecorder?.mimeType || 'video/mp4' });
        resolve(blob);
      };
      
      this.mediaRecorder.start();
      
      // Maximum record time: 10 seconds, or until released
      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      }, 10000);
    });
  }

  onSubmit() {
     // Overridden by pointer events, but kept to prevent form sub errors
  }

  private submitData(videoBlob?: Blob) {
    this.isSubmitting = true;
    const formData: EmotionData = {
      ...this.emotionForm.value,
      text_input: this.emotionForm.value.reason,
      hasLocalVideo: !!videoBlob
    };
      
      // Freeze the form's dimensions so CSS can smoothly animate them down
      if (this.formElement) {
        const rect = this.formElement.nativeElement.getBoundingClientRect();
        this.formElement.nativeElement.style.setProperty('--start-width', `${rect.width}px`);
        this.formElement.nativeElement.style.setProperty('--start-height', `${rect.height}px`);
      }
      
      this.emotionService.logEmotion(formData).subscribe({
        next: (res: any) => {
          const spawnedEmotion: EmotionData = {
            ...formData,
            local_time: new Date().toISOString(),
            _id: Math.random().toString(36).substr(2, 9),
            username: res.username // Use the username returned by the backend
          };

          // Save video to IndexedDB if we have one, using the new emotion ID
          if (videoBlob && spawnedEmotion._id) {
            this.videoStorageService.saveVideo(spawnedEmotion._id, videoBlob);
          }
          
          this.isSubmitting = false;
          this.stopCamera(); // Turn off camera after success
          this.successMessage = 'Logged Successfully!';
          
          // Force angular to apply the 'morphing' class IMMEDIATELY
          this.morphState = 'morphing';
          if (this.cdr) this.cdr.detectChanges();
          
          // 1. Wait 600ms for the CSS transition to circle to complete
          setTimeout(() => {
            // 2. Hold the perfect circle shape for 1 second
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
            }, 1000);
          }, 600);
        },
        error: (err) => {
          console.error('Submission failed', err);
          this.isSubmitting = false;
        }
      });
  }
}
