import { Component, ElementRef, OnInit, OnDestroy, ViewChild, AfterViewInit, inject, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { Subscription } from 'rxjs';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { EmotionService, EmotionData } from '../../services/emotion';
import { LocationService } from '../../services/location';

const simplexNoise3D = `
// GLSL 3D Simplex noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}
`;

const emotionDistortionProfiles: Record<string, { amplitude: number, frequency: number, speed: number, pulseAmplitude: number, pulseSpeed: number, shapeType: number }> = {
  // Intense & Erratic (High noise, fast throb, SPIKY shape)
  'Anger': { amplitude: 0.35, frequency: 0.012, speed: 6.0, pulseAmplitude: 0.0, pulseSpeed: 0.0, shapeType: 1.0 },
  'Fear': { amplitude: 0.28, frequency: 0.015, speed: 7.0, pulseAmplitude: 0.02, pulseSpeed: 15.0, shapeType: 1.0 },
  'Disgust': { amplitude: 0.25, frequency: 0.005, speed: 2.0, pulseAmplitude: 0.05, pulseSpeed: 3.0, shapeType: 2.0 }, // Ridged
  
  // Energetic & Bubbly (Medium noise, bouncy pulse, ROUND shape)
  'Joy': { amplitude: 0.25, frequency: 0.003, speed: 3.0, pulseAmplitude: 0.12, pulseSpeed: 4.0, shapeType: 0.0 },
  'Elation': { amplitude: 0.30, frequency: 0.0035, speed: 3.5, pulseAmplitude: 0.14, pulseSpeed: 5.0, shapeType: 0.0 },
  'Surprise': { amplitude: 0.28, frequency: 0.004, speed: 4.0, pulseAmplitude: 0.10, pulseSpeed: 6.0, shapeType: 0.0 },
  
  // Negative & Heavy (Low frequency noise, slow heavy throb, ROUND shape)
  'Sadness': { amplitude: 0.16, frequency: 0.001, speed: 0.5, pulseAmplitude: 0.06, pulseSpeed: 1.0, shapeType: 0.0 },
  'Guilt': { amplitude: 0.18, frequency: 0.0015, speed: 0.8, pulseAmplitude: 0.05, pulseSpeed: 1.5, shapeType: 0.0 },
  'Shame': { amplitude: 0.12, frequency: 0.001, speed: 0.5, pulseAmplitude: 0.03, pulseSpeed: 0.8, shapeType: 0.0 },
  
  // Mixed / Tense (Asymmetric, irregular feel, RIDGED shape)
  'Contempt': { amplitude: 0.20, frequency: 0.003, speed: 1.5, pulseAmplitude: 0.05, pulseSpeed: 2.0, shapeType: 2.0 },
  'Envy': { amplitude: 0.22, frequency: 0.004, speed: 2.0, pulseAmplitude: 0.06, pulseSpeed: 2.5, shapeType: 2.0 },
  
  // Positive & Focused (Smooth, rhythmic pulse, ROUND shape)
  'Pride': { amplitude: 0.20, frequency: 0.002, speed: 1.5, pulseAmplitude: 0.08, pulseSpeed: 2.0, shapeType: 0.0 },
  'Hope': { amplitude: 0.16, frequency: 0.0015, speed: 1.2, pulseAmplitude: 0.10, pulseSpeed: 2.5, shapeType: 0.0 },
  'Interest': { amplitude: 0.18, frequency: 0.0025, speed: 2.0, pulseAmplitude: 0.06, pulseSpeed: 3.0, shapeType: 0.0 },
  
  // Calm & Breathing (Very low noise, deep slow pulse, ROUND shape)
  'Relief': { amplitude: 0.08, frequency: 0.001, speed: 0.4, pulseAmplitude: 0.10, pulseSpeed: 1.0, shapeType: 0.0 },
  'Satisfaction': { amplitude: 0.05, frequency: 0.0008, speed: 0.3, pulseAmplitude: 0.08, pulseSpeed: 0.8, shapeType: 0.0 }
};

@Component({
  selector: 'app-emotion-spheres',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './emotion-spheres.html',
  styleUrls: ['./emotion-spheres.css']
})
export class EmotionSpheresComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('container', { static: true }) containerRef!: ElementRef;
  @ViewChild('bgCanvas', { static: true }) bgCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fgCanvas', { static: true }) fgCanvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() showText: boolean = true;
  @Input() viewMode: 'world' | 'me' = 'world';
  @Input() currentTheme: 'dark' | 'light' = 'dark';
  @Output() emotionSelected = new EventEmitter<boolean>();

  selectedEmotion: any = null;
  overlayX: number = 0;
  overlayY: number = 0;
  private locationService = inject(LocationService);
  private emotionService = inject(EmotionService);
  private cdr = inject(ChangeDetectorRef);
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private bgRenderer!: THREE.WebGLRenderer;
  private fgRenderer!: THREE.WebGLRenderer;
  private animationFrameId!: number;
  private spheres: THREE.Mesh[] = [];
  private textGroups: THREE.Group[] = [];
  private font!: any;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredEmotionId: string | null = null;
  private orbitControls!: OrbitControls;
  
  private lodGeometries = {
    high: new THREE.SphereGeometry(2000, 64, 64),
    med: new THREE.SphereGeometry(2000, 32, 32),
    low: new THREE.SphereGeometry(2000, 16, 16),
    tiny: new THREE.SphereGeometry(2000, 8, 8)
  };

  private targetCameraPos = new THREE.Vector3(0, 0, 4000);
  private targetOrbitCenter = new THREE.Vector3(0, 0, 0);
  private isCameraAnimating = false;
  private isLightMode = false;
  private mediaQueryList!: MediaQueryList;
  private deleteSub!: Subscription;

  public formatDate(dateString: string): string {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }

  public emotionColorsLight: Record<string, string> = {
    'Anger': '#ff393c',        // 1. Red
    'Contempt': '#ff8d28',     // 2. Orange
    'Disgust': '#ac7f5e',      // 3. Brown
    'Envy': '#b2d600',         // 4. Lime (NEW)
    'Guilt': '#ffcc02',        // 5. Yellow
    'Shame': '#00c8b3',        // 6. Mint
    'Fear': '#35c759',         // 7. Green
    'Sadness': '#03c3d1',      // 8. Teal
    'Surprise': '#00c0e8',     // 9. Cyan
    'Interest': '#33a1ff',     // 10. Sky Blue (NEW)
    'Hope': '#0088ff',         // 11. Blue
    'Relief': '#8c9eff',       // 12. Periwinkle (NEW)
    'Satisfaction': '#6155f5', // 13. Indigo
    'Joy': '#cb30e0',          // 14. Purple
    'Elation': '#ff2c55',      // 15. Pink
    'Pride': '#ea1c9b'         // 16. Magenta (NEW)
  };

  public emotionColorsDark: Record<string, string> = {
    'Anger': '#ff4246',        // 1. Red
    'Contempt': '#ff9230',     // 2. Orange
    'Disgust': '#b78a66',      // 3. Brown
    'Envy': '#bce300',         // 4. Lime (NEW)
    'Guilt': '#fed703',        // 5. Yellow
    'Shame': '#00dac3',        // 6. Mint
    'Fear': '#31d158',         // 7. Green
    'Sadness': '#00d2e0',      // 8. Teal
    'Surprise': '#3cd3fe',     // 9. Cyan
    'Interest': '#47acff',     // 10. Sky Blue (NEW)
    'Hope': '#0091ff',         // 11. Blue
    'Relief': '#9fb0ff',       // 12. Periwinkle (NEW)
    'Satisfaction': '#6d7cff', // 13. Indigo
    'Joy': '#db33f2',          // 14. Purple
    'Elation': '#ff375f',      // 15. Pink
    'Pride': '#fa25a8'         // 16. Magenta (NEW)
  };

  private getEmotionColor(emotion: string): string {
    const palette = this.isLightMode ? this.emotionColorsLight : this.emotionColorsDark;
    return palette[emotion] || (this.isLightMode ? '#888888' : '#bbbbbb');
  }

  public emotionEmojis: { [key: string]: string } = {
    Anger: '😡', Contempt: '😒', Disgust: '🤢', Envy: '😐',
    Guilt: '😣', Shame: '😳', Fear: '😨', Sadness: '😢',
    Surprise: '😲', Interest: '🧐', Hope: '🙂', Relief: '😮‍💨',
    Satisfaction: '😊', Joy: '😆', Elation: '😌', Pride: '🥹'
  };

  private createHeaderSprite(emotion: string, emoji: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    // High-DPI Canvas for sharp text
    const scaleFactor = 4;
    
    const emojiFont = `${300 * scaleFactor}px sans-serif`;
    const titleFont = `bold ${220 * scaleFactor}px "SF Pro Display", sans-serif`;
    
    context.font = emojiFont;
    const emojiWidth = context.measureText(emoji).width;
    context.font = titleFont;
    const titleText = emotion.toLowerCase();
    const titleWidth = context.measureText(titleText).width;
    
    const logicalWidth = Math.max(emojiWidth, titleWidth) / scaleFactor + 80;
    const logicalHeight = 650;
    
    canvas.width = logicalWidth * scaleFactor;
    canvas.height = logicalHeight * scaleFactor;
    
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    
    const centerX = canvas.width / 2;
    
    context.font = emojiFont;
    context.fillText(emoji, centerX, 240 * scaleFactor);
    
    context.font = titleFont;
    context.fillStyle = this.isLightMode ? 'rgba(31, 41, 55, 0.4)' : 'rgba(255, 255, 255, 0.4)';
    context.fillText(titleText, centerX, 520 * scaleFactor);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, opacity: 0 });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(logicalWidth * 2, logicalHeight * 2, 1);
    // Save logical width for layout
    sprite.userData['logicalWidth'] = logicalWidth * 2; 
    sprite.userData['logicalHeight'] = logicalHeight * 2;
    return sprite;
  }

  private createFooterSprite(username: string, date: string, distance: number | null): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    const scaleFactor = 4;
    const font = `${130 * scaleFactor}px monospace`; // slightly smaller font
    context.font = font;
    
    const text = `${username || 'Anonymous'}  ${date}  ${distance !== null ? distance.toFixed(0) + 'km away' : ''}`;
    const textWidth = context.measureText(text).width;
    
    const logicalWidth = textWidth / scaleFactor + 60;
    const logicalHeight = 220;
    
    canvas.width = logicalWidth * scaleFactor;
    canvas.height = logicalHeight * scaleFactor;
    
    context.font = font;
    context.fillStyle = this.isLightMode ? '#6b7280' : '#aaaaaa';
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, opacity: 0 });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(logicalWidth * 2, logicalHeight * 2, 1);
    sprite.userData['logicalWidth'] = logicalWidth * 2;
    sprite.userData['logicalHeight'] = logicalHeight * 2;
    return sprite;
  }

  constructor() {}

  private pointerDownClientX = 0;
  private pointerDownClientY = 0;

  ngAfterViewInit(): void {
    this.initThreeJS();
    
    // Load the font, then fetch data
    const loader = new FontLoader();
    loader.load('/fonts/droid_sans_mono_regular.typeface.json', (font) => {
      this.font = font;
      this.fetchData();
    });
    
    // Listen for window resize
    window.addEventListener('resize', this.onWindowResize);
    // Listen for pointer interactions
    this.containerRef.nativeElement.addEventListener('pointerdown', this.onPointerDown);
    this.containerRef.nativeElement.addEventListener('pointerup', this.onPointerUp);
    this.containerRef.nativeElement.addEventListener('pointermove', this.onPointerMove);
    this.containerRef.nativeElement.addEventListener('pointerleave', this.onPointerLeave);
    
    // Listen for theme changes from system preference, although now overridden by Input
    if (typeof window !== 'undefined') {
      this.mediaQueryList = window.matchMedia('(prefers-color-scheme: light)');
      this.isLightMode = this.currentTheme === 'light'; // override with Input value
      this.mediaQueryList.addEventListener('change', this.onThemeChange);
    }
    
    this.deleteSub = this.emotionService.emotionDeleted$.subscribe(deletedId => {
      this.removeSphereById(deletedId);
    });
  }

  private onThemeChange = (e: MediaQueryListEvent) => {
    this.isLightMode = e.matches;
    this.updateThreeJsColors();
  }

  private updateThreeJsColors() {
    const textColor = this.isLightMode ? 0x1f2937 : 0xffffff;
    
    this.textGroups.forEach(tg => {
      tg.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.color.setHex(textColor);
        }
      });
      
      const emotionId = tg.userData['emotionId'];
      if (this.selectedEmotion && this.selectedEmotion.emotion._id === emotionId) {
         const header = tg.userData['headerSprite'];
         const footer = tg.userData['footerSprite'];
         if (header && footer) {
           tg.remove(header);
           if (header.material.map) header.material.map.dispose();
           header.material.dispose();
           tg.remove(footer);
           if (footer.material.map) footer.material.map.dispose();
           footer.material.dispose();
           
           const emoji = this.emotionEmojis[this.selectedEmotion.emotion.emotion] || '😶';
           const newHeader = this.createHeaderSprite(this.selectedEmotion.emotion.emotion, emoji);
           const newFooter = this.createFooterSprite(this.selectedEmotion.emotion.username, this.formatDate(this.selectedEmotion.emotion.local_time), this.selectedEmotion.distance);
           
           tg.add(newHeader);
           tg.add(newFooter);
           tg.userData['headerSprite'] = newHeader;
           tg.userData['footerSprite'] = newFooter;
         }
      }
    });
    
    // Update sphere colors
    this.spheres.forEach(sphere => {
      const emotionData = sphere.userData['emotion'];
      if (emotionData) {
        const newColor = new THREE.Color(this.getEmotionColor(emotionData.emotion));
        if (sphere.material instanceof THREE.MeshBasicMaterial) {
          sphere.material.color = newColor;
        }
        sphere.children.forEach(child => {
          if (child.userData['isSolidChild'] && child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.color = newColor;
          }
        });
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['viewMode'] && !changes['viewMode'].isFirstChange() && this.font) {
      this.fetchData();
    }
    
    if (changes['showText'] && this.textGroups) {
      this.textGroups.forEach(group => {
        group.visible = this.showText && !this.selectedEmotion;
      });
    }

    if (changes['currentTheme']) {
      this.isLightMode = this.currentTheme === 'light';
      this.updateThreeJsColors();
    }
  }

  private initThreeJS(): void {
    const width = this.containerRef.nativeElement.clientWidth;
    const height = this.containerRef.nativeElement.clientHeight;

    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(45, width / height, 10, 25000);
    this.camera.position.set(0, 0, 4000);
    // Important for dual canvas layers
    this.camera.layers.enable(0);
    this.camera.layers.enable(1);
    
    this.bgRenderer = new THREE.WebGLRenderer({ canvas: this.bgCanvasRef.nativeElement, antialias: true, alpha: true });
    this.bgRenderer.setPixelRatio(window.devicePixelRatio);
    this.bgRenderer.setSize(width, height);
    
    this.fgRenderer = new THREE.WebGLRenderer({ canvas: this.fgCanvasRef.nativeElement, antialias: true, alpha: true });
    this.fgRenderer.setPixelRatio(window.devicePixelRatio);
    this.fgRenderer.setSize(width, height);

    this.orbitControls = new OrbitControls(this.camera, this.containerRef.nativeElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.minDistance = 100;
    this.orbitControls.maxDistance = 12000;
    
    // Stop camera animation if user starts dragging
    this.orbitControls.addEventListener('start', () => {
      this.isCameraAnimating = false;
    });

    this.animate();
  }

  private onWindowResize = () => {
    const width = this.containerRef.nativeElement.clientWidth;
    const height = this.containerRef.nativeElement.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.bgRenderer.setSize(width, height);
    this.fgRenderer.setSize(width, height);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.pointerDownClientX = event.clientX;
    this.pointerDownClientY = event.clientY;
  }

  private onPointerMove = (event: PointerEvent) => {
    if (this.selectedEmotion) {
        if (this.hoveredEmotionId) {
            this.hoveredEmotionId = null;
            document.body.style.cursor = 'default';
        }
        return;
    }
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.spheres, false);
    
    if (intersects.length > 0) {
        const sphere = intersects[0].object as THREE.Mesh;
        this.hoveredEmotionId = sphere.userData['emotion']?._id || null;
        document.body.style.cursor = 'pointer';
    } else if (this.hoveredEmotionId) {
        this.hoveredEmotionId = null;
        document.body.style.cursor = 'default';
    }
  }

  private onPointerLeave = (event: PointerEvent) => {
    this.hoveredEmotionId = null;
    document.body.style.cursor = 'default';
  }

  private onPointerUp = async (event: PointerEvent) => {
    if (event.button !== 0) return;
    
    // Distinguish between a drag and a click
    const distance = Math.hypot(event.clientX - this.pointerDownClientX, event.clientY - this.pointerDownClientY);
    if (distance > 5) return; // it was a drag, ignore click logic
    
    if ((event.target as HTMLElement).closest('.emotion-detail-overlay')) return;

    if (this.selectedEmotion) {
       this.closeDetail();
       return;
    }

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.spheres, false);

    if (intersects.length > 0) {
      const selectedSphere = intersects[0].object as THREE.Mesh;
      const emotionData = selectedSphere.userData['emotion'];
      
      const finalSize = selectedSphere.userData['currentSize'] || 350;
      
      const worldPos = new THREE.Vector3();
      selectedSphere.getWorldPosition(worldPos);
      
      const direction = new THREE.Vector3().subVectors(this.camera.position, worldPos).normalize();
      
      const isMobile = window.innerWidth <= 768 || (window.innerWidth / window.innerHeight) < 1.2;
      const right = new THREE.Vector3().crossVectors(this.camera.up, direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      
      let rightOffsetAmount = 0;
      let upOffsetAmount = 0;
      let zoomDistance = finalSize * 3.8;
      
      if (isMobile) {
        upOffsetAmount = -finalSize * 1.0; 
        zoomDistance = finalSize * 6.5; 
      } else {
        rightOffsetAmount = finalSize * 0.8; 
        zoomDistance = finalSize * 5.0;
      }
      
      this.targetOrbitCenter.copy(worldPos)
        .add(right.clone().multiplyScalar(rightOffsetAmount))
        .add(up.clone().multiplyScalar(upOffsetAmount));
        
      this.targetCameraPos.copy(worldPos)
        .add(direction.multiplyScalar(zoomDistance))
        .add(right.clone().multiplyScalar(rightOffsetAmount))
        .add(up.clone().multiplyScalar(upOffsetAmount));
      
      this.isCameraAnimating = true;

      let dist = null;
      try {
        const userLoc = await this.locationService.getLocation();
        if (userLoc) {
          const R = 6371; // Earth's radius in km
          const dLat = THREE.MathUtils.degToRad(emotionData.latitude - userLoc.latitude);
          const dLon = THREE.MathUtils.degToRad(emotionData.longitude - userLoc.longitude);
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(THREE.MathUtils.degToRad(userLoc.latitude)) * Math.cos(THREE.MathUtils.degToRad(emotionData.latitude)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
          dist = R * c;
        }
      } catch (err) {
        console.error("Could not calculate distance", err);
      }

      this.selectedEmotion = {
        emotion: emotionData,
        distance: dist
      };
      this.emotionSelected.emit(true);
      
      // Move selected to layer 1 for sharp rendering and make it solid
      this.spheres.forEach(s => {
        s.layers.set(0);
        (s.material as THREE.MeshBasicMaterial).wireframe = true;
      });
      selectedSphere.layers.set(1);
      (selectedSphere.material as THREE.MeshBasicMaterial).wireframe = false;
      
      // We don't hide 3D text anymore! It will morph.
      this.textGroups.forEach(tg => {
         if (tg.userData['emotionId'] !== emotionData._id) {
           tg.visible = false;
         } else {
           tg.visible = true;
           
           // Generate WebGL Metadata Sprites!
           const emoji = this.emotionEmojis[emotionData.emotion] || '😶';
           const headerSprite = this.createHeaderSprite(emotionData.emotion, emoji);
           const footerSprite = this.createFooterSprite(emotionData.username, this.formatDate(emotionData.local_time), dist);
           
           tg.add(headerSprite);
           tg.add(footerSprite);
           tg.userData['headerSprite'] = headerSprite;
           tg.userData['footerSprite'] = footerSprite;
           
           tg.traverse((child) => child.layers.set(1));
         }
      });
      
      this.cdr.detectChanges();
    } else {
      this.closeDetail();
    }
  }

  public closeDetail() {
    this.selectedEmotion = null;
    this.emotionSelected.emit(false);
    this.targetCameraPos.set(0, 0, 4000);
    this.targetOrbitCenter.set(0, 0, 0);
    this.isCameraAnimating = true;
    
    // Reset layers and visibility
    this.spheres.forEach(s => {
      s.layers.set(0);
      const mat = s.material as THREE.MeshBasicMaterial;
      mat.wireframe = true;
      mat.opacity = 1;
    });
    this.textGroups.forEach(tg => {
      tg.visible = this.showText;
      
      const header = tg.userData['headerSprite'];
      const footer = tg.userData['footerSprite'];
      if (header) { tg.remove(header); header.material.map?.dispose(); header.material.dispose(); }
      if (footer) { tg.remove(footer); footer.material.map?.dispose(); footer.material.dispose(); }
      tg.userData['headerSprite'] = null;
      tg.userData['footerSprite'] = null;
      
      tg.traverse((child) => child.layers.set(0));
    });
    
    this.cdr.detectChanges();
  }

  private calculateDensity(currentEmotion: EmotionData, emotionsData: EmotionData[], radiusThreshold: number): number {
    const currentLatRad = THREE.MathUtils.degToRad(currentEmotion.latitude);
    const currentLonRad = THREE.MathUtils.degToRad(currentEmotion.longitude);
    let count = 0;
    emotionsData.forEach(emotion => {
      const latRad = THREE.MathUtils.degToRad(emotion.latitude);
      const lonRad = THREE.MathUtils.degToRad(emotion.longitude);
      const d = Math.acos(Math.sin(currentLatRad) * Math.sin(latRad) + Math.cos(currentLatRad) * Math.cos(latRad) * Math.cos(Math.abs(currentLonRad - lonRad))) * 6371;
      if (d <= radiusThreshold) count++;
    });
    return count;
  }

  private calculateSizeOverTime(creationTime: string, minSize: number, maxSize: number): number {
    const now = new Date().getTime();
    const elapsed = now - new Date(creationTime).getTime();
    const totalDuration = 96 * 60 * 60 * 1000;
    const sizeScale = Math.max(minSize, maxSize - ((elapsed / totalDuration) * (maxSize - minSize)));
    return sizeScale;
  }

  private clearSpheres(): void {
    this.spheres.forEach(s => {
      this.scene.remove(s);
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    });
    this.spheres = [];
    
    this.textGroups.forEach(tg => {
      this.scene.remove(tg);
    });
    this.textGroups = [];
  }

  private removeSphereById(emotionId: string): void {
    // Remove sphere
    const sphereIndex = this.spheres.findIndex(s => s.userData['emotion']?._id === emotionId);
    if (sphereIndex !== -1) {
      const s = this.spheres[sphereIndex];
      this.scene.remove(s);
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
      this.spheres.splice(sphereIndex, 1);
    }
    
    // Remove text group
    const textGroupIndex = this.textGroups.findIndex(tg => tg.userData['emotionId'] === emotionId);
    if (textGroupIndex !== -1) {
      const tg = this.textGroups[textGroupIndex];
      this.scene.remove(tg);
      this.textGroups.splice(textGroupIndex, 1);
    }
  }

  private fetchData(): void {
    const request$ = this.viewMode === 'world' ? this.emotionService.getEmotions() : this.emotionService.getUserEmotions();
    request$.subscribe({
      next: (data) => {
        this.clearSpheres();
        this.renderSpheres(data);
      },
      error: (err) => {
        console.error('Failed to load emotions:', err);
      }
    });
  }

  private renderSpheres(emotionsData: EmotionData[]): void {
    emotionsData.forEach(emotion => {
      this.createAndAddSphere(emotion, emotionsData);
    });
  }

  private createAndAddSphere(emotion: EmotionData, allEmotions: EmotionData[] = []): { sphere: THREE.Mesh, textGroup: THREE.Group } {
    const radius = 1000;
    const maxSize = 2000;
    const initialSize = maxSize;
    
    const color = this.getEmotionColor(emotion.emotion);
    const density = this.calculateDensity(emotion, allEmotions.length ? allEmotions : [emotion], 6000);
    
    const geometry = this.lodGeometries.high;
    const profile = emotionDistortionProfiles[emotion.emotion] || { amplitude: 0.1, frequency: 0.001, speed: 1.0, pulseAmplitude: 0.05, pulseSpeed: 1.0, shapeType: 0.0 };
    const uniforms = {
      uTime: { value: Math.random() * 100 }, // Random start time
      uAmplitude: { value: profile.amplitude },
      uFrequency: { value: profile.frequency },
      uSpeed: { value: profile.speed },
      uPulseAmplitude: { value: profile.pulseAmplitude },
      uPulseSpeed: { value: profile.pulseSpeed },
      uShapeType: { value: profile.shapeType }
    };

    const setupShader = (shader: any) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uAmplitude = uniforms.uAmplitude;
      shader.uniforms.uFrequency = uniforms.uFrequency;
      shader.uniforms.uSpeed = uniforms.uSpeed;
      shader.uniforms.uPulseAmplitude = uniforms.uPulseAmplitude;
      shader.uniforms.uPulseSpeed = uniforms.uPulseSpeed;
      shader.uniforms.uShapeType = uniforms.uShapeType;
      
      shader.vertexShader = `
        uniform float uTime;
        uniform float uAmplitude;
        uniform float uFrequency;
        uniform float uSpeed;
        uniform float uPulseAmplitude;
        uniform float uPulseSpeed;
        uniform float uShapeType;
        
        ${simplexNoise3D}
      ` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 displacedPos = position;
        float noise = snoise(vec3(position * uFrequency + uTime * uSpeed));
        
        if (uShapeType > 1.5) {
            // Type 2: Ridged
            noise = 1.0 - abs(noise);
            noise = pow(noise, 2.0);
        } else if (uShapeType > 0.5) {
            // Type 1: Spiky / Chaotic
            float noise2 = snoise(vec3(position * uFrequency * 2.0 + uTime * uSpeed * 1.5));
            noise = noise + (noise2 * 0.7); // Add a second octave of noise for jagged spikes
        }
        
        float pulse = sin(uTime * uPulseSpeed) * uPulseAmplitude;
        displacedPos += normal * (noise * uAmplitude + pulse) * length(position);
        vec3 transformed = displacedPos;
        `
      );
    };

    const material = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 1 });
    material.onBeforeCompile = setupShader;
    const sphere = new THREE.Mesh(geometry, material);

    const solidMaterial = new THREE.MeshBasicMaterial({ color, wireframe: false, transparent: true, opacity: 1 });
    solidMaterial.onBeforeCompile = setupShader;
    const solidSphere = new THREE.Mesh(geometry, solidMaterial);
    solidSphere.userData = { isSolidChild: true, isSpawningPhase: true };
    sphere.add(solidSphere);

    const latitudeInRadians = THREE.MathUtils.degToRad(emotion.latitude);
    const longitudeInRadians = THREE.MathUtils.degToRad(emotion.longitude);

    const x = radius * Math.cos(latitudeInRadians) * Math.sin(longitudeInRadians);
    const y = radius * Math.sin(latitudeInRadians);
    const z = radius * Math.cos(latitudeInRadians) * Math.cos(longitudeInRadians);

    sphere.position.set(x, y, z);
    sphere.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    
    sphere.userData = {
      shaderUniforms: uniforms,
      animationParams: {
        speed: Math.random() * 0.005 + 0.001,
        amplitudeX: Math.random() * 50 + 10,
        amplitudeY: Math.random() * 50 + 10,
        amplitudeZ: Math.random() * 50 + 10,
        offsetX: Math.random() * Math.PI * 2,
        offsetY: Math.random() * Math.PI * 2,
        offsetZ: Math.random() * Math.PI * 2,
        spinX: (Math.random() - 0.5) * 0.02,
        spinY: (Math.random() - 0.5) * 0.02,
        spinZ: (Math.random() - 0.5) * 0.02,
      },
      originalPosition: { x, y, z },
      creationTime: emotion.local_time,
      density,
      emotion: emotion
    };

    this.scene.add(sphere);
    this.spheres.push(sphere);

    let textGroup: THREE.Group;
    if (emotion.text_input && emotion.text_input.trim().length > 0) {
      textGroup = this.createTextGroup(this.font, emotion.text_input, maxSize);
    } else {
      textGroup = new THREE.Group();
    }
    
    const randomTextSpeed = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.01 + 0.005);
    textGroup.userData = { sphere, rotationSpeed: randomTextSpeed, originalScale: 1.0, emotionId: emotion._id };
    textGroup.position.copy(sphere.position);
    textGroup.visible = this.showText;
    this.scene.add(textGroup);
    this.textGroups.push(textGroup);
    
    return { sphere, textGroup };
  }

  public addSpawnedSphere(emotion: EmotionData): void {
    const { sphere } = this.createAndAddSphere(emotion, []);
    
    // Position it in front of the camera, shifted down slightly to match the DOM animation drop point
    const spawnPos = this.camera.position.clone().add(new THREE.Vector3(0, -300, -800));
    this.scene.worldToLocal(spawnPos);
    
    sphere.position.copy(spawnPos);
    sphere.userData['velocity'] = new THREE.Vector3(0, 0, 0);
    sphere.userData['isSpawning'] = true;
  }



  private calculateTargetLayout(textGroup: THREE.Group, sphereRadius: number) {
    const isMobile = window.innerWidth <= 768 || (window.innerWidth / window.innerHeight) < 1.2;
    let textScale = 0.75; 
    
    const meshes: { mesh: THREE.Mesh, char: string, width: number, parentQuat: THREE.Quaternion }[] = [];
    textGroup.children.forEach(zRotGrp => {
       if (zRotGrp.userData['isZRotationGroup']) {
          const charMesh = zRotGrp.children[0] as THREE.Mesh;
          meshes.push({
             mesh: charMesh,
             char: charMesh.userData['charStr'],
             width: charMesh.userData['charWidth'],
             parentQuat: zRotGrp.quaternion.clone()
          });
       }
    });

    const wrapWidthUnscaled = isMobile ? sphereRadius * 3.5 : sphereRadius * 2.5;
    
    const words: { meshes: any[], width: number }[] = [];
    let currentWord: any[] = [];
    let currentWordWidth = 0;
    
    meshes.forEach(m => {
       if (m.char === ' ' || m.char === '•') {
           if (currentWord.length > 0) {
               words.push({ meshes: currentWord, width: currentWordWidth });
               currentWord = [];
               currentWordWidth = 0;
           }
           words.push({ meshes: [m], width: m.width });
       } else {
           currentWord.push(m);
           currentWordWidth += m.width;
       }
    });
    if (currentWord.length > 0) words.push({ meshes: currentWord, width: currentWordWidth });
    
    const lines: { meshes: any[], width: number }[] = [];
    let currentLine: any[] = [];
    let currentLineWidth = 0;
    
    words.forEach(w => {
       if (currentLineWidth + w.width > wrapWidthUnscaled && currentLine.length > 0) {
           lines.push({ meshes: currentLine, width: currentLineWidth });
           currentLine = w.meshes;
           currentLineWidth = w.width;
       } else {
           currentLine.push(...w.meshes);
           currentLineWidth += w.width;
       }
    });
    if (currentLine.length > 0) lines.push({ meshes: currentLine, width: currentLineWidth });
    
    let unscaledMaxLineWidth = 0;
    const charSpacing = sphereRadius * 0.035;
    lines.forEach(l => {
       const w = l.width + (l.meshes.length - 1) * charSpacing;
       if (w > unscaledMaxLineWidth) unscaledMaxLineWidth = w;
    });
    
    const unscaledHeight = lines.length * (sphereRadius * 0.35);
    
    const maxAllowedWidth = isMobile ? sphereRadius * 3.5 : sphereRadius * 2.2;
    const maxAllowedHeight = isMobile ? sphereRadius * 4.0 : sphereRadius * 2.8;
    
    if (unscaledMaxLineWidth > 0 && unscaledMaxLineWidth * textScale > maxAllowedWidth) {
        textScale = maxAllowedWidth / unscaledMaxLineWidth;
    }
    if (unscaledHeight > 0 && unscaledHeight * textScale > maxAllowedHeight) {
        textScale = Math.min(textScale, maxAllowedHeight / unscaledHeight);
    }
    
    textScale = Math.min(textScale, 0.5);
    
    const flatLineHeight = sphereRadius * 0.35 * textScale;
    const finalScaledWidth = unscaledMaxLineWidth * textScale;
    
    let startY = 0;
    if (isMobile) {
        startY = -sphereRadius * 1.9; 
    } else {
        startY = (lines.length * flatLineHeight) / 2 - (flatLineHeight / 2) - (sphereRadius * 0.4);
    }
    
    textGroup.userData['layoutTopY'] = startY;
    textGroup.userData['maxLineWidth'] = finalScaledWidth;
    textGroup.userData['textScale'] = textScale;
    
    lines.forEach((line) => {
       const lineUnscaledWidth = line.width + (line.meshes.length - 1) * charSpacing;
       const lineScaledWidth = lineUnscaledWidth * textScale;
       const centerX = isMobile ? 0 : sphereRadius * 1.1 + finalScaledWidth / 2;
       let xOffset = centerX - lineScaledWidth / 2; 
       line.meshes.forEach(m => {
           const targetGlobal = new THREE.Vector3(xOffset, startY, 0);
           
           const invQuat = m.mesh.parent!.quaternion.clone().invert();
           const targetLocal = targetGlobal.clone().applyQuaternion(invQuat);
           
           m.mesh.userData['targetPos'] = targetLocal;
           m.mesh.userData['targetRot'] = new THREE.Euler().setFromQuaternion(invQuat);
           m.mesh.userData['targetScale'] = textScale;
           
           xOffset += (m.width + charSpacing) * textScale; 
       });
       startY -= flatLineHeight;
    });
    
    textGroup.userData['layoutBottomY'] = startY;
  }

  private createTextGroup(font: any, text: string, sphereRadius: number): THREE.Group {
    const textGroup = new THREE.Group();
    
    const maxLengthPerLine = 60;
    const lines = [];
    
    if (text.length > maxLengthPerLine) {
      const words = text.split(' ');
      let currentLine = '';
      let i = 0;
      
      while (i < words.length && currentLine.length + words[i].length < text.length / 2) {
        currentLine += words[i] + ' ';
        i++;
      }
      lines.push(`"${currentLine.trim()}" `);
      
      currentLine = '';
      while (i < words.length) {
        currentLine += words[i] + ' ';
        i++;
      }
      lines.push(`"${currentLine.trim()}" `);
    } else {
      lines.push(`"${text}" `);
    }

    const baseRadius = sphereRadius * 1.4; 

    lines.forEach((lineText, lineIndex) => {
      const textLength = lineText.length;
      const maxSpacing = 0.18; 
      const minSpacing = (2 * Math.PI) / Math.max(textLength, 1);
      const angleIncrement = Math.min(maxSpacing, minSpacing);
      
      const currentRadius = baseRadius + (lineIndex * sphereRadius * 0.3);

      for (let i = 0; i < textLength; i++) {
        const charStr = lineText.charAt(i);
        const charGeometry = new TextGeometry(charStr, {
          font: font,
          size: sphereRadius * 0.25,
          depth: 1,
          curveSegments: 12,
          bevelEnabled: false,
        });

        charGeometry.computeBoundingBox();
        let charWidth = charGeometry.boundingBox!.max.x - charGeometry.boundingBox!.min.x;
        if (charStr === ' ') charWidth = sphereRadius * 0.08; 

        const charMaterial = new THREE.MeshBasicMaterial({ color: this.isLightMode ? 0x1f2937 : 0xffffff });
        const charMesh = new THREE.Mesh(charGeometry, charMaterial);

        const angle = i * angleIncrement;
        const x = currentRadius * Math.cos(angle);
        const y = currentRadius * Math.sin(angle);

        charMesh.position.set(x, y, 0);
        charMesh.rotation.z = angle + Math.PI / 2;

        charMesh.userData['charStr'] = charStr;
        charMesh.userData['charWidth'] = charWidth;
        charMesh.userData['originalPos'] = charMesh.position.clone();
        charMesh.userData['originalRot'] = charMesh.rotation.clone();

        const zRotationGroup = new THREE.Group();
        zRotationGroup.userData['isZRotationGroup'] = true;
        zRotationGroup.add(charMesh);

        textGroup.add(zRotationGroup);
      }
    });

    return textGroup;
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    // Slowly rotate the entire scene horizontally, but pause if inspecting an emotion
    if (!this.selectedEmotion) {
      this.scene.rotation.y += 0.003;
    }

    let time = Date.now() * 0.025;
    const minSize = 400;
    const maxSize = 2000;

    // Scale globe radius based on camera zoom so spheres spread out
    const cameraDist = this.camera.position.length();
    // Cap the scale factor so it doesn't grow infinitely
    const scaleFactor = Math.min(2.5, Math.max(1, cameraDist / 3500));
    // Base camera distance is ~4000, base radius is 1000
    const globeRadius = 1000 * scaleFactor;

    // Physics Step: Calculate repulsive forces
    for (let i = 0; i < this.spheres.length; i++) {
      const s1 = this.spheres[i];
      if (!s1.userData['velocity']) s1.userData['velocity'] = new THREE.Vector3();
      
      const isSelected1 = this.selectedEmotion && s1.userData['emotion']?._id === this.selectedEmotion.emotion._id;
      if (isSelected1) continue;
      
      const params = s1.userData['animationParams'];
      const originalPos = s1.userData['originalPosition'];
      const factor = 7.5;

      // Calculate floaty GPS position
      const floatyTarget = new THREE.Vector3(
        originalPos.x + Math.sin(time * params.speed + params.offsetX) * params.amplitudeX * factor,
        originalPos.y + Math.sin(time * params.speed + params.offsetY) * params.amplitudeY * factor,
        originalPos.z + Math.sin(time * params.speed + params.offsetZ) * params.amplitudeZ * factor
      );
      floatyTarget.normalize().multiplyScalar(globeRadius);
      
      // Spring force pulling toward floaty target (very gentle)
      const springForce = new THREE.Vector3().subVectors(floatyTarget, s1.position).multiplyScalar(0.001);
      s1.userData['velocity'].add(springForce);

      // Collision Repulsion
      for (let j = i + 1; j < this.spheres.length; j++) {
        const s2 = this.spheres[j];
        
        if (s1.userData['isSpawning'] || s2.userData['isSpawning']) continue;
        
        const isSelected2 = this.selectedEmotion && s2.userData['emotion']?._id === this.selectedEmotion.emotion._id;
        if (isSelected2) continue;
        
        if (!s2.userData['velocity']) s2.userData['velocity'] = new THREE.Vector3();
        
        let distSq = s1.position.distanceToSquared(s2.position);
        
        // Break perfect overlaps with microscopic jitter
        if (distSq === 0) {
          s1.position.x += (Math.random() - 0.5) * 1;
          s1.position.y += (Math.random() - 0.5) * 1;
          s1.position.z += (Math.random() - 0.5) * 1;
          s1.position.normalize().multiplyScalar(globeRadius);
          distSq = s1.position.distanceToSquared(s2.position);
        }
        
        const size1 = s1.userData['currentSize'] || 500;
        const size2 = s2.userData['currentSize'] || 500;
        // Collision threshold: sum of radii (scaled for text breathing room and zoom scaleFactor)
        const minSpace = (size1 + size2) * 1.5 * scaleFactor; 
        const minSpaceSq = minSpace * minSpace;
        
        if (distSq > 0 && distSq < minSpaceSq) {
          const dist = Math.sqrt(distSq);
          // Push force increases dramatically as they get closer
          const pushForce = ((minSpace - dist) / minSpace) * 10.0;
          const pushVec = new THREE.Vector3().subVectors(s1.position, s2.position).normalize().multiplyScalar(pushForce);
          
          s1.userData['velocity'].add(pushVec);
          s2.userData['velocity'].sub(pushVec);
        }
      }
    }

    // Apply Physics and Update Scale
    this.spheres.forEach(sphere => {
      const isSelected = this.selectedEmotion && sphere.userData['emotion']?._id === this.selectedEmotion.emotion._id;
      const isHovered = this.hoveredEmotionId === sphere.userData['emotion']?._id;

      if (!isSelected && sphere.userData['velocity']) {
        sphere.userData['velocity'].multiplyScalar(0.85); // Damping
        sphere.position.add(sphere.userData['velocity']);
        
        if (sphere.userData['isSpawning']) {
          // Spring towards original surface position
          const target = sphere.userData['originalPosition'];
          const targetVec = new THREE.Vector3(target.x, target.y, target.z);
          const spring = new THREE.Vector3().subVectors(targetVec, sphere.position).multiplyScalar(0.02);
          sphere.position.add(spring);
          
          if (sphere.position.distanceTo(targetVec) < 10) {
            sphere.userData['isSpawning'] = false;
          }
        } else {
          sphere.position.normalize().multiplyScalar(globeRadius); // Snap to surface
        }
      }
      
      if (sphere.children.length > 0) {
        const solidChild = sphere.children[0] as THREE.Mesh;
        if (solidChild && solidChild.userData['isSolidChild']) {
          const mat = solidChild.material as THREE.MeshBasicMaterial;
          const targetOpacity = isHovered ? 1.0 : 0.05; // Fade completely into a solid sphere
          if (solidChild.userData['isSpawningPhase']) {
            mat.opacity -= 0.005; // Fade out slowly after spawn
            if (mat.opacity <= targetOpacity) {
              solidChild.userData['isSpawningPhase'] = false;
            }
          } else {
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
          }
        }
      }
      
      const spinParams = sphere.userData['animationParams'];
      if (spinParams) {
        sphere.rotation.x += spinParams.spinX || 0.01;
        sphere.rotation.y += spinParams.spinY || 0.01;
        sphere.rotation.z += spinParams.spinZ || 0;
      }
      
      const uniforms = sphere.userData['shaderUniforms'];
      if (uniforms) {
        uniforms.uTime.value += 0.02; 
      }

      // Update sphere size based on elapsed time (older = smaller)
      const size = this.calculateSizeOverTime(sphere.userData['creationTime'], minSize, maxSize);
      const densityFactor = 0.15; // Fixed scalar instead of dynamic crowding
      let finalSize = size * densityFactor;
      sphere.userData['currentSize'] = finalSize;
      
      const sizeRatio = finalSize / maxSize;
      let targetGeo = this.lodGeometries.high;
      if (sizeRatio < 0.1) targetGeo = this.lodGeometries.tiny;
      else if (sizeRatio < 0.3) targetGeo = this.lodGeometries.low;
      else if (sizeRatio < 0.6) targetGeo = this.lodGeometries.med;
      
      if (sphere.geometry !== targetGeo) {
        sphere.geometry = targetGeo;
        if (sphere.children.length > 0 && sphere.children[0].userData['isSolidChild']) {
          (sphere.children[0] as THREE.Mesh).geometry = targetGeo;
        }
      }

      sphere.scale.set(finalSize / maxSize, finalSize / maxSize, finalSize / maxSize);

      // Update the corresponding text group size
      const textGroup = this.textGroups.find(
        (group) => group.userData['emotionId'] === sphere.userData['emotion']?._id
      );

      if (textGroup) {
        const textSizeFactor = finalSize / maxSize;
        textGroup.scale.set(textSizeFactor, textSizeFactor, textSizeFactor);
      }
    });

    // Update the text groups to track spheres and face the camera
    this.textGroups.forEach((textGroup, index) => {
      const sphere = textGroup.userData['sphere'];
      const rotationSpeed = textGroup.userData['rotationSpeed'];
      const isSelected = this.selectedEmotion?.emotion._id === textGroup.userData['emotionId'];
      const isHovered = this.hoveredEmotionId === textGroup.userData['emotionId'];
      
      if (sphere) {
        textGroup.position.copy(sphere.position);

        if (!isSelected) {
          // Unselected: Normal spherical halo lookAt
          textGroup.lookAt(this.camera.position);

          textGroup.userData['morphProgress'] = 0;
          textGroup.userData['targetCalculated'] = false;

          textGroup.children.forEach(zRotationGroup => {
            if (zRotationGroup.userData['isZRotationGroup']) {
              zRotationGroup.rotation.z += rotationSpeed;
              
              const charMesh = zRotationGroup.children[0] as THREE.Mesh;
              if (charMesh) {
                 const origPos = charMesh.userData['originalPos'];
                 const origRot = charMesh.userData['originalRot'];
                 charMesh.position.lerp(origPos, 0.1);
                 
                 // Apply bold text scaling on hover
                 const boldScaleX = isHovered ? 1.45 : 1.0; // stretch horizontally a lot
                 const boldScaleY = isHovered ? 1.25 : 1.0; // stretch vertically slightly
                 charMesh.scale.x = THREE.MathUtils.lerp(charMesh.scale.x, boldScaleX, 0.15);
                 charMesh.scale.y = THREE.MathUtils.lerp(charMesh.scale.y, boldScaleY, 0.15);
                 charMesh.scale.z = 1.0;

                 charMesh.rotation.x = THREE.MathUtils.lerp(charMesh.rotation.x, origRot.x, 0.1);
                 charMesh.rotation.y = THREE.MathUtils.lerp(charMesh.rotation.y, origRot.y, 0.1);
                 charMesh.rotation.z = THREE.MathUtils.lerp(charMesh.rotation.z, origRot.z, 0.1);
              }
            }
          });
        } else {
          // Selected: Align perfectly parallel to the camera plane without mirroring
          const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
          textGroup.up.copy(cameraUp);
          
          const camToTarget = new THREE.Vector3().subVectors(this.camera.position, this.orbitControls.target);
          const lookTarget = textGroup.position.clone().add(camToTarget);
          textGroup.lookAt(lookTarget);

          if (!textGroup.userData['targetCalculated']) {
            this.calculateTargetLayout(textGroup, 2000); // maxSize is 2000
            textGroup.userData['targetCalculated'] = true;
          }

          let p = textGroup.userData['morphProgress'] || 0;
          p += 0.02; // Global animation speed
          if (p > 1.5) p = 1.5; 
          textGroup.userData['morphProgress'] = p;

          textGroup.children.forEach((zRotationGroup, i) => {
            if (zRotationGroup.userData['isZRotationGroup']) {
              const charMesh = zRotationGroup.children[0] as THREE.Mesh;
              if (charMesh && charMesh.userData['targetPos']) {
                 const delay = i * 0.01;
                 let charP = (p - delay) * 2.0; 
                 charP = Math.max(0, Math.min(1, charP));
                 const smoothP = charP * charP * (3 - 2 * charP);
                 
                 const targetPos = charMesh.userData['targetPos'];
                 const targetRot = charMesh.userData['targetRot'];
                 const origPos = charMesh.userData['originalPos'];
                 const origRot = charMesh.userData['originalRot'];
                 
                 let finalTargetScale = charMesh.userData['targetScale'] || 1.0;
                 if (charMesh.userData['charStr'] === '•') {
                     finalTargetScale = 0; // shrink the bullet dot to 0
                 }
                 
                 charMesh.position.lerpVectors(origPos, targetPos, smoothP);
                 charMesh.scale.setScalar(THREE.MathUtils.lerp(1.0, finalTargetScale, smoothP));
                 charMesh.rotation.x = THREE.MathUtils.lerp(origRot.x, targetRot.x, smoothP);
                 charMesh.rotation.y = THREE.MathUtils.lerp(origRot.y, targetRot.y, smoothP);
                 charMesh.rotation.z = THREE.MathUtils.lerp(origRot.z, targetRot.z, smoothP);
              }
            }
          });
          
          const header = textGroup.userData['headerSprite'] as THREE.Sprite;
          const footer = textGroup.userData['footerSprite'] as THREE.Sprite;
          if (header && footer) {
             const topY = textGroup.userData['layoutTopY'] || 0;
             const bottomY = textGroup.userData['layoutBottomY'] || 0;
             const tScale = textGroup.userData['textScale'] || 1.0;
             
             const isMobile = window.innerWidth <= 768 || (window.innerWidth / window.innerHeight) < 1.2;
             const headerLogicalWidth = header.userData['logicalWidth'];
             const footerLogicalWidth = footer.userData['logicalWidth'];
             const footerLogicalHeight = footer.userData['logicalHeight'] || 280;
             const headerLogicalHeight = header.userData['logicalHeight'] || 480;
             
             const maxLineWidth = textGroup.userData['maxLineWidth'] || 0;
             const centerX = isMobile ? 0 : (2000 * 1.1) + maxLineWidth / 2; // maxSize is 2000
             
             const headerX = centerX;
             const footerX = centerX;
             
             header.scale.set(headerLogicalWidth * tScale, headerLogicalHeight * tScale, 1);
             footer.scale.set(footerLogicalWidth * tScale, footerLogicalHeight * tScale, 1);
             
             header.position.set(headerX, topY + (1600 * tScale), 0);
             footer.position.set(footerX, bottomY - (50 * tScale), 0);
             
             header.material.opacity = p;
             footer.material.opacity = p;
          }
        }
      }
    });

    if (this.isCameraAnimating) {
      // Tween camera position
      this.camera.position.lerp(this.targetCameraPos, 0.05);
      // Tween orbit controls target
      this.orbitControls.target.lerp(this.targetOrbitCenter, 0.05);
      this.orbitControls.update();
      
      if (this.camera.position.distanceTo(this.targetCameraPos) < 1) {
        this.isCameraAnimating = false;
      }
    } else {
      this.orbitControls.update();
    }

    // Update overlay position if an emotion is selected
    if (this.selectedEmotion) {
      const selectedSphere = this.spheres.find(s => s.userData['emotion']?._id === this.selectedEmotion.emotion._id);
      if (selectedSphere) {
        const isMobile = window.innerWidth <= 768 || (window.innerWidth / window.innerHeight) < 1.2;
        
        const finalSize = selectedSphere.userData['currentSize'] || 350;

        const centerVector = selectedSphere.position.clone();
        const direction = new THREE.Vector3().subVectors(this.camera.position, selectedSphere.position).normalize();
        const right = new THREE.Vector3().crossVectors(this.camera.up, direction).normalize();
        const up = new THREE.Vector3().crossVectors(direction, right).normalize();
        
        // Offset text to the right edge of the sphere in 3D
        const rightEdgePos = centerVector.clone().add(right.multiplyScalar(finalSize * 1.5));
        const bottomEdgePos = centerVector.clone().add(up.multiplyScalar(-finalSize * 1.2));
        
        rightEdgePos.project(this.camera);
        bottomEdgePos.project(this.camera);
        
        const desktopX = (rightEdgePos.x * 0.5 + 0.5) * window.innerWidth;
        const desktopY = -(rightEdgePos.y * 0.5 - 0.5) * window.innerHeight;
        
        const mobileY = -(bottomEdgePos.y * 0.5 - 0.5) * window.innerHeight;
        
        this.overlayX = isMobile ? 0 : desktopX;
        this.overlayY = isMobile ? mobileY : desktopY;
        this.cdr.detectChanges();
      }
    }

    // Render background layer (0)
    this.camera.layers.set(0);
    this.bgRenderer.render(this.scene, this.camera);
    
    // Render foreground layer (1) for selected sphere
    this.camera.layers.set(1);
    this.fgRenderer.render(this.scene, this.camera);
  }



  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.bgRenderer) this.bgRenderer.dispose();
    if (this.fgRenderer) this.fgRenderer.dispose();
    if (this.mediaQueryList) {
      this.mediaQueryList.removeEventListener('change', this.onThemeChange);
    }
    if (this.containerRef) {
      this.containerRef.nativeElement.removeEventListener('pointerdown', this.onPointerDown);
      this.containerRef.nativeElement.removeEventListener('pointerup', this.onPointerUp);
      this.containerRef.nativeElement.removeEventListener('pointermove', this.onPointerMove);
      this.containerRef.nativeElement.removeEventListener('pointerleave', this.onPointerLeave);
    }
    if (this.deleteSub) {
      this.deleteSub.unsubscribe();
    }
  }
}
