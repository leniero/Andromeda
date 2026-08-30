import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface EmotionData {
  _id?: string;
  userId?: string;
  user?: string;
  emotion: string;
  reason: string;
  latitude: number;
  longitude: number;
  local_time: string;
  text_input?: string;
  distance?: number;
  isPublic?: boolean;
  username?: string;
  hasLocalVideo?: boolean;
  clientId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmotionService {
  private http = inject(HttpClient);
  private isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  private apiUrl = this.isLocal ? 'http://localhost:5001/api/emotions' : 'https://andromeda-server.vercel.app/api/emotions';

  public emotionColorsLight: Record<string, string> = {
    'Anger': '#ff393c', 'Contempt': '#ff8d28', 'Disgust': '#ac7f5e', 'Envy': '#b2d600',
    'Guilt': '#ffcc02', 'Shame': '#00c8b3', 'Fear': '#35c759', 'Sadness': '#03c3d1',
    'Surprise': '#00c0e8', 'Interest': '#33a1ff', 'Hope': '#0088ff', 'Relief': '#8c9eff',
    'Satisfaction': '#6155f5', 'Joy': '#cb30e0', 'Elation': '#ff2c55', 'Pride': '#ea1c9b'
  };

  public emotionColorsDark: Record<string, string> = {
    'Anger': '#ff4246', 'Contempt': '#ff9230', 'Disgust': '#b78a66', 'Envy': '#bce300',
    'Guilt': '#fed703', 'Shame': '#00dac3', 'Fear': '#31d158', 'Sadness': '#00d2e0',
    'Surprise': '#3cd3fe', 'Interest': '#47acff', 'Hope': '#0091ff', 'Relief': '#9fb0ff',
    'Satisfaction': '#6d7cff', 'Joy': '#db33f2', 'Elation': '#ff375f', 'Pride': '#fa25a8'
  };

  public getEmotionColor(emotion: string): string {
    if (typeof document === 'undefined') return this.emotionColorsDark[emotion] || '#bbbbbb';
    const attr = document.documentElement.getAttribute('data-theme');
    const isLightMode = attr === 'light' || (!attr && window.matchMedia('(prefers-color-scheme: light)').matches);
    const palette = isLightMode ? this.emotionColorsLight : this.emotionColorsDark;
    return palette[emotion] || (isLightMode ? '#888888' : '#bbbbbb');
  }

  private emotionDeletedSource = new Subject<string>();
  emotionDeleted$ = this.emotionDeletedSource.asObservable();

  constructor() {}

  getEmotions(): Observable<EmotionData[]> {
    return this.http.get<EmotionData[]>(`${this.apiUrl}/get_emotions`);
  }

  getUserEmotions(): Observable<EmotionData[]> {
    return this.http.get<EmotionData[]>(`${this.apiUrl}/get_user_emotions`);
  }

  logEmotion(data: EmotionData): Observable<EmotionData> {
    return this.http.post<EmotionData>(`${this.apiUrl}/submit`, data);
  }

  deleteEmotion(emotionId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${emotionId}`);
  }

  notifyEmotionDeleted(emotionId: string): void {
    this.emotionDeletedSource.next(emotionId);
  }
}
