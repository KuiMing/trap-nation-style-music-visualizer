import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { VisualizerConfig, Preset } from './types';
import { DynamicStyle, AspectRatio, ExportFormat, ParticleBehavior, BackgroundBehavior, LogoBehavior } from './types';
import { ALL_STYLES, INITIAL_CONFIG } from './constants';

// --- Helper UI Components ---

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  displayFormatter?: (value: number) => string;
}

const SliderControl: React.FC<SliderProps> = ({ label, value, min, max, step, onChange, displayFormatter }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <div className="flex items-center space-x-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-primary"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-20 bg-brand-bg border border-brand-border rounded-md px-2 py-1 text-center"
        aria-label={label}
      />
    </div>
  </div>
);


interface ColorPickerProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
}

const ColorControl: React.FC<ColorPickerProps> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between mb-4">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <div className="relative w-10 h-10 rounded-md border-2 border-brand-border cursor-pointer overflow-hidden" style={{ backgroundColor: value }}>
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
        </div>
    </div>
);

interface CheckboxProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const CheckboxControl: React.FC<CheckboxProps> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between mb-4">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <button
          onClick={() => onChange(!checked)}
          className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
            checked ? 'bg-brand-primary' : 'bg-brand-border'
          }`}
        >
          <span
            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
);


// --- Main App Component ---

const App: React.FC = () => {
  const [config, setConfig] = useState<Preset>(INITIAL_CONFIG);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.NineSixteen);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(ExportFormat.MP4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaStreamDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const particlesRef = useRef<any[]>([]);
  const currentScaleRef = useRef(1);
  const bgAnimationTimeRef = useRef(0);
  const lastParticleBehaviorRef = useRef<ParticleBehavior | null>(null);

  const lastBassAvgRef = useRef<number>(0);

  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.smoothingTimeConstant = config.smoothingTimeConstant;
    }
  }, [config.smoothingTimeConstant]);

  // --- File Handling ---

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
    } else {
        setAudioFile(null);
        setAudioUrl(null);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setLogoUrl(url);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        logoImageRef.current = img;
      };
    } else {
        setLogoUrl(null);
        logoImageRef.current = null;
    }
  };

  const handleBackgroundImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setBackgroundImageUrl(url);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        backgroundImageRef.current = img;
      };
    } else {
        setBackgroundImageUrl(null);
        backgroundImageRef.current = null;
    }
  };

  const handleRemoveBackgroundImage = () => {
    if (backgroundImageUrl) {
        URL.revokeObjectURL(backgroundImageUrl);
    }
    setBackgroundImageUrl(null);
    backgroundImageRef.current = null;
  };
  
  // --- Audio API Setup ---

  const setupAudioContext = () => {
    if (audioRef.current && !audioContextRef.current) {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = config.smoothingTimeConstant;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaElementSource(audioRef.current);
      sourceRef.current = source;
      
      const mediaStreamDestination = audioContext.createMediaStreamDestination();
      mediaStreamDestinationRef.current = mediaStreamDestination;

      source.connect(analyser);
      analyser.connect(audioContext.destination); // For live playback
      analyser.connect(mediaStreamDestination); // For recording
    }
  };

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    
    const onPlay = () => {
      setupAudioContext();
      audioContextRef.current?.resume();
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);

    audioEl.addEventListener('play', onPlay);
    audioEl.addEventListener('pause', onPause);

    return () => {
      audioEl.removeEventListener('play', onPlay);
      audioEl.removeEventListener('pause', onPause);
    };
  }, [audioUrl]);

  // --- Canvas Rendering Logic ---

  const drawParticles = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    avg: number
) => {
    const resetParticles = () => {
        particlesRef.current = [];
        for (let i = 0; i < 100; i++) {
            particlesRef.current.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 2 + 1,
                vx_base: Math.random() * 1 - 0.5,
                vy_base: Math.random() * 1 - 0.5,
                angle: Math.random() * Math.PI * 2,
                distance: Math.random() * Math.min(width, height) * 0.5,
            });
        }
    };

    if (particlesRef.current.length === 0 || lastParticleBehaviorRef.current !== config.particleBehavior) {
        resetParticles();
        lastParticleBehaviorRef.current = config.particleBehavior;
    }

    ctx.fillStyle = config.particleColor;
    const centerX = width / 2;
    const centerY = height / 2;

    particlesRef.current.forEach(p => {
        switch (config.particleBehavior) {
            case ParticleBehavior.Gravity:
                p.y += p.vy_base + 1;
                p.x += p.vx_base;
                if (p.y > height) { p.y = 0; p.x = Math.random() * width; }
                break;
            case ParticleBehavior.AntiGravity:
                p.y -= (p.vy_base + 1);
                p.x += p.vx_base;
                if (p.y < 0) { p.y = height; p.x = Math.random() * width; }
                break;
            case ParticleBehavior.RadialOut:
                const speed = (avg / 255) * 2;
                p.distance += speed + 0.1;
                p.x = centerX + Math.cos(p.angle) * p.distance;
                p.y = centerY + Math.sin(p.angle) * p.distance;
                if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
                    p.distance = Math.random() * 50;
                    p.angle = Math.random() * Math.PI * 2;
                }
                break;
            case ParticleBehavior.VortexIn:
                const vortexSpeed = (avg / 255) * 1.5;
                p.distance -= vortexSpeed + 0.1;
                p.angle += 0.01;
                p.x = centerX + Math.cos(p.angle) * p.distance;
                p.y = centerY + Math.sin(p.angle) * p.distance;
                if (p.distance < 1) {
                    p.distance = Math.random() * Math.min(width, height) * 0.5;
                    p.angle = Math.random() * Math.PI * 2;
                }
                break;
            case ParticleBehavior.Static:
            default:
                p.x += p.vx_base;
                p.y += p.vy_base;
                if (p.x < 0 || p.x > width) p.vx_base *= -1;
                if (p.y < 0 || p.y > height) p.vy_base *= -1;
                break;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}, []);

    const drawDynamicVisualizer = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, frequencyData: Uint8Array, time: number, bassAvg: number) => {
    ctx.save();
    
    const barData = frequencyData;
    const avg = barData.reduce((a, b) => a + b, 0) / (barData.length || 1);
    
    let angle: number, x: number, y: number, x2: number, y2: number, barHeight: number;
    const value = (i: number) => barData[i] || 0;
        
    switch (config.dynamicStyle) {
        case DynamicStyle.PyroBurst: {
            const gradient = ctx.createLinearGradient(0, -height / 4, 0, height / 4);
            gradient.addColorStop(0, config.spectrumColor1);
            gradient.addColorStop(1, config.spectrumColor2);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = config.barWidth;

            const radius = Math.min(width, height) * 0.05;
            const pulseRadius = radius + avg * 0.1 * config.motionIntensity;
            ctx.lineCap = 'round';
            for (let i = 0; i < config.barCount; i++) {
                barHeight = (value(i) / 255) * height * 0.15 * config.motionIntensity;
                angle = (i / config.barCount) * Math.PI * 2;
                x = Math.cos(angle) * pulseRadius;
                y = Math.sin(angle) * pulseRadius;
                x2 = Math.cos(angle) * (pulseRadius + barHeight);
                y2 = Math.sin(angle) * (pulseRadius + barHeight);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            break;
        }
        case DynamicStyle.GlacialShards: {
            const gradient = ctx.createLinearGradient(0, -height / 4, 0, height / 4);
            gradient.addColorStop(0, config.spectrumColor1);
            gradient.addColorStop(1, config.spectrumColor2);
            ctx.strokeStyle = gradient;
            const spikes = config.starSpikes;
            const outerRadius = Math.min(width, height) * 0.18;
            const innerRadius = outerRadius * config.starInnerRadius;
            ctx.beginPath();
            for (let i = 0; i <= config.barCount; i++) {
                const index = i % config.barCount;
                barHeight = (value(index) / 255) * height * 0.1 * config.motionIntensity;
                angle = (index / config.barCount) * Math.PI * 2;

                const progressToSpike = ((angle / (Math.PI * 2)) * spikes) % 1;
                let currentRadius = innerRadius + (outerRadius - innerRadius) * Math.abs(progressToSpike - 0.5) * 2;

                const r = currentRadius + barHeight;
                x = Math.cos(angle) * r;
                y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            break;
        }
        case DynamicStyle.CelestialBloom: {
            const gradient = ctx.createLinearGradient(0, -height / 4, 0, height / 4);
            gradient.addColorStop(0, config.spectrumColor1);
            gradient.addColorStop(1, config.spectrumColor2);
            ctx.strokeStyle = gradient;
            const baseRadius = Math.min(width, height) * 0.05;
            const bloomFactor = 1 + Math.sin(time * 2) * 0.2;
            ctx.beginPath();
            for (let i = 0; i <= config.barCount; i++) {
                const index = i % config.barCount;
                barHeight = (value(index) / 255) * height * 0.12 * config.motionIntensity * bloomFactor;
                angle = (index / config.barCount) * Math.PI * 2;
                const r = baseRadius + barHeight;
                x = Math.cos(angle) * r;
                y = Math.sin(angle) * r;

                const cx1 = Math.cos(angle) * (r - barHeight*0.5);
                const cy1 = Math.sin(angle) * (r - barHeight*0.5);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.quadraticCurveTo(cx1, cy1, x, y);
            }
            ctx.closePath();
            ctx.stroke();
            break;
        }
        case DynamicStyle.QuantumEntanglement:
            // No central visualizer, only particles
            break;
    }
    
    ctx.restore();

  }, [config]);


  const animate = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
    };

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const { width, height } = canvas;
    const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
    const bassAvg = dataArray.slice(0, 16).reduce((a, b) => a + b, 0) / 16;
    const isAudioPlaying = avg > 1;

    // Filter frequency data for visualizer based on user settings
    const rangeStart = Math.floor(bufferLength * config.frequencyRangeStart);
    const rangeEnd = Math.floor(bufferLength * config.frequencyRangeEnd);
    const visualizerData = dataArray.slice(rangeStart, rangeEnd);

    // Detect bass hits for pulse effects
    lastBassAvgRef.current = bassAvg;


    bgAnimationTimeRef.current += 0.002;
    
    const targetScale = isAudioPlaying ? 1 + (avg / 255) * 0.07 : 1;
    currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.1;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // --- Global Transforms (Zoom & Shake) ---
    ctx.translate(width / 2, height / 2);
    ctx.scale(currentScaleRef.current, currentScaleRef.current);
    
    const baseShake = isAudioPlaying ? (bassAvg / 255) * config.cameraShakeIntensity * 15 : 0;
    const totalShake = baseShake;
    const shakeX = (Math.random() - 0.5) * totalShake;
    const shakeY = (Math.random() - 0.5) * totalShake;
    ctx.translate(shakeX, shakeY);
    
    ctx.translate(-width / 2, -height / 2);
    
    // --- Background ---
    if (backgroundImageRef.current && backgroundImageRef.current.complete) {
        const img = backgroundImageRef.current;
        const canvasAspect = width / height;
        const imgAspect = img.width / img.height;
        let sx, sy, sWidth, sHeight;

        if (imgAspect > canvasAspect) {
            sHeight = img.height;
            sWidth = img.height * canvasAspect;
            sx = (img.width - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = img.width;
            sHeight = img.width / canvasAspect;
            sx = 0;
            sy = (img.height - sHeight) / 2;
        }

        ctx.save();
        
        const bgTime = bgAnimationTimeRef.current;
        switch (config.backgroundBehavior) {
            case BackgroundBehavior.SlowPan:
                ctx.translate(Math.sin(bgTime) * 50, Math.cos(bgTime) * 30);
                break;
            case BackgroundBehavior.GentleZoom:
                const zoom = 1 + Math.sin(bgTime * 0.8) * 0.1;
                ctx.translate(width/2, height/2);
                ctx.scale(zoom, zoom);
                ctx.translate(-width/2, -height/2);
                break;
            case BackgroundBehavior.AudioPulse:
                 const pulse = 1 + (avg / 255) * 0.05;
                 ctx.translate(width/2, height/2);
                 ctx.scale(pulse, pulse);
                 ctx.translate(-width/2, -height/2);
                break;
            case BackgroundBehavior.Static:
            default:
                break;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
        ctx.restore();
    } else {
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, config.bgColor1);
        bgGradient.addColorStop(1, config.bgColor2);
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
    }

    // --- Foreground Elements ---
    drawParticles(ctx, width, height, config, avg);

    // --- Logo and Anchored Visualizer ---
    if (logoImageRef.current && logoImageRef.current.complete) {
        const logo = logoImageRef.current;
        const baseSize = Math.min(width, height) * 0.3; 
        const maxDimension = baseSize * config.logoSize;

        const logoAspectRatio = logo.width / logo.height;
        let logoDrawWidth: number;
        let logoDrawHeight: number;

        if (logoAspectRatio > 1) { // Landscape logo
            logoDrawWidth = maxDimension;
            logoDrawHeight = maxDimension / logoAspectRatio;
        } else { // Portrait or square logo
            logoDrawHeight = maxDimension;
            logoDrawWidth = maxDimension * logoAspectRatio;
        }

        ctx.save();
        
        // --- This block now controls BOTH the logo and the visualizer ---

        // Center transformations
        ctx.translate(width / 2, height / 2);

        // Apply dynamic logo behavior
        const logoPulse = 1 + (avg / 255) * 0.1;
        const logoShake = (bassAvg / 255) * 15;
        const time = bgAnimationTimeRef.current;

        switch (config.logoBehavior) {
            case LogoBehavior.Pulse:
                ctx.scale(logoPulse, logoPulse);
                break;
            case LogoBehavior.Shake:
                ctx.translate((Math.random() - 0.5) * logoShake, (Math.random() - 0.5) * logoShake);
                break;
            case LogoBehavior.Float:
                ctx.translate(Math.sin(time * 0.5) * 10, Math.cos(time * 0.3) * 10);
                break;
            case LogoBehavior.Static:
            default:
                break;
        }
        
        // --- Draw Anchored Visualizer ---
        if (isAudioPlaying) {
            ctx.save();
            ctx.shadowColor = config.spectrumColor1;
            ctx.shadowBlur = config.glowRadius * (avg / 255);
            // Position the spectrum relative to the logo's center
            ctx.translate(0, logoDrawHeight * 0.3); // Adjust Y-offset to position below logo center
            drawDynamicVisualizer(ctx, width, height, visualizerData, time, bassAvg);
            ctx.restore();
        }

        // --- Draw Logo on top ---
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = (avg / 255) * 30;
        ctx.drawImage(logo, -logoDrawWidth / 2, -logoDrawHeight / 2, logoDrawWidth, logoDrawHeight);

        ctx.restore(); // Restore from logo-specific transforms
    }

    ctx.restore(); // Restore from global zoom & shake

    // --- Screen-space & High-Energy FX ---
    if (config.highEnergyFx && isAudioPlaying && bassAvg > 220) {
        const flashOpacity = Math.min(0.7, ((bassAvg - 220) / 35) * 1.5);
        ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
        ctx.fillRect(0, 0, width, height);
    }

    animationFrameIdRef.current = requestAnimationFrame(animate);

  }, [config, drawParticles, drawDynamicVisualizer]);


  useEffect(() => {
    animationFrameIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    let width, height;
    
    const parent = canvas.parentElement;
    if (parent) {
      if(aspectRatio === AspectRatio.SixteenNine) {
        width = parent.clientWidth;
        height = parent.clientWidth * 9 / 16;
      } else {
        height = parent.clientHeight;
        width = parent.clientHeight * 9 / 16;
      }
    } else {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx?.scale(dpr, dpr);
  }, [aspectRatio]);

  const handleGenerateClick = async () => {
    if (!canvasRef.current || !audioRef.current || !audioFile || !mediaStreamDestinationRef.current) return;

    if (typeof MediaRecorder === 'undefined') {
        alert('Your browser does not support video recording.');
        return;
    }

    let finalFormat = exportFormat;
    if (!MediaRecorder.isTypeSupported(finalFormat)) {
        console.warn(`${finalFormat} not supported, falling back to video/webm`);
        finalFormat = ExportFormat.WebM;
        setExportFormat(ExportFormat.WebM);
        if (!MediaRecorder.isTypeSupported(finalFormat)) {
             alert('Neither MP4 nor WebM recording is supported in your browser.');
             return;
        }
    }
    
    setIsGenerating(true);
    setExportProgress(0);

    const canvas = canvasRef.current;
    const audio = audioRef.current;
    
    const wasPlaying = !audio.paused;
    if (wasPlaying) audio.pause();
    audio.currentTime = 0;

    const videoStream = canvas.captureStream(30);
    const audioStream = mediaStreamDestinationRef.current.stream;
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ]);

    const recorder = new MediaRecorder(combinedStream, { mimeType: finalFormat });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: finalFormat });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        const fileExtension = finalFormat === ExportFormat.MP4 ? 'mp4' : 'webm';
        a.download = `visualizer-video.${fileExtension}`;
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        setIsGenerating(false);
        setExportProgress(0);
        combinedStream.getTracks().forEach(track => track.stop()); 
        
        if (wasPlaying) audio.play();
    };

    const onTimeUpdate = () => {
        if (audio.duration > 0) {
            setExportProgress((audio.currentTime / audio.duration) * 100);
        }
    };

    const onEnded = () => {
        recorder.stop();
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
    };
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    recorder.start();
    audio.play();
  };
  
  const handlePresetSelect = (preset: Preset) => {
    setConfig(preset);
  };

  return (
    <div className="flex h-screen bg-brand-bg text-gray-200 font-sans">
      {/* Main Content (Preview) */}
      <div className="flex-grow flex flex-col items-center justify-center p-4 lg:p-8">
        <div className={`w-full max-w-5xl flex flex-col items-center justify-center space-y-4`}>
          {/* Phone Mockup */}
          <div className={`bg-black border-8 border-gray-800 rounded-[40px] shadow-2xl p-2 ${aspectRatio === AspectRatio.SixteenNine ? 'w-full aspect-[16/9]' : 'w-auto h-[80vh] aspect-[9/16]'}`}>
            <div className="w-full h-full bg-brand-bg rounded-[32px] overflow-hidden relative">
                {isGenerating && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 rounded-[32px]">
                        <div className="text-2xl font-bold mb-4 text-white">Generating Video...</div>
                        <div className="w-3/4 bg-brand-border rounded-full h-4 overflow-hidden">
                            <div 
                                className="bg-brand-primary h-4 rounded-full transition-all duration-150" 
                                style={{ width: `${exportProgress}%` }}
                            ></div>
                        </div>
                        <div className="mt-2 text-lg text-white">{Math.round(exportProgress)}%</div>
                    </div>
                )}
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>
          </div>
          {audioUrl && (
            <audio ref={audioRef} src={audioUrl} controls className="w-full max-w-md"></audio>
          )}
        </div>
      </div>

      {/* Sidebar (Controls) */}
      <aside className="w-[380px] bg-brand-surface flex-shrink-0 flex flex-col h-screen border-l border-brand-border">
        <div className="p-6 border-b border-brand-border">
          <h1 className="text-xl font-bold">Visualizer Studio</h1>
        </div>

        <fieldset disabled={isGenerating} className="flex-grow overflow-y-auto">
          {/* Upload Section */}
          <div className="p-6 border-b border-brand-border">
            <h2 className="text-lg font-semibold mb-4 text-brand-primary">Assets</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Audio File*</label>
                <input type="file" accept="audio/*" onChange={handleAudioFileChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20"/>
                {audioFile && <p className="text-xs text-gray-400 mt-2">{audioFile.name}</p>}
              </div>
               <div>
                <label className="text-sm font-medium mb-2 block">Logo Image</label>
                <input type="file" accept="image/*" onChange={handleLogoFileChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20"/>
                {logoUrl && <img src={logoUrl} className="w-16 h-16 object-contain mt-2 rounded-md bg-black/20 p-1"/>}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Background Image</label>
                <input type="file" accept="image/*" onChange={handleBackgroundImageChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20"/>
                {backgroundImageUrl && (
                    <div className="relative w-24 h-14 object-contain mt-2 rounded-md bg-black/20 p-1 group">
                        <img src={backgroundImageUrl} className="w-full h-full object-contain"/>
                        <button 
                            onClick={handleRemoveBackgroundImage} 
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove background image"
                        >
                            &times;
                        </button>
                    </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Style Section */}
          <div className="p-6 border-b border-brand-border">
            <h2 className="text-lg font-semibold mb-4 text-brand-primary">Visual Style</h2>
            <div className="grid grid-cols-3 gap-2">
                {ALL_STYLES.map(preset => (
                    <button
                        key={preset.name}
                        onClick={() => handlePresetSelect(preset)}
                        className={`p-2 rounded-md text-center text-xs border-2 transition-colors h-12 flex items-center justify-center ${
                            config.name === preset.name
                                ? 'bg-brand-primary/20 border-brand-primary font-semibold'
                                : 'bg-brand-bg border-brand-border hover:border-gray-600'
                        }`}
                        title={preset.name}
                    >
                       <span className="truncate">{preset.name}</span>
                    </button>
                ))}
            </div>
          </div>

          {/* Customize Section */}
          <div className="p-6 border-b border-brand-border">
            <h2 className="text-lg font-semibold mb-4 text-brand-primary">Customize</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Particle Behavior</label>
                    <select 
                        value={config.particleBehavior} 
                        onChange={(e) => setConfig(p=>({...p, name: 'Custom', particleBehavior: e.target.value as ParticleBehavior}))} 
                        className="w-full bg-brand-bg border border-brand-border rounded-md px-2 py-2 text-sm"
                    >
                        {Object.values(ParticleBehavior).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                {backgroundImageUrl && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Background Behavior</label>
                        <select 
                            value={config.backgroundBehavior} 
                            onChange={(e) => setConfig(p=>({...p, name: 'Custom', backgroundBehavior: e.target.value as BackgroundBehavior}))} 
                            className="w-full bg-brand-bg border border-brand-border rounded-md px-2 py-2 text-sm"
                        >
                            {Object.values(BackgroundBehavior).map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                )}
                {logoUrl && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Logo Behavior</label>
                        <select 
                            value={config.logoBehavior} 
                            onChange={(e) => setConfig(p=>({...p, name: 'Custom', logoBehavior: e.target.value as LogoBehavior}))} 
                            className="w-full bg-brand-bg border border-brand-border rounded-md px-2 py-2 text-sm"
                        >
                            {Object.values(LogoBehavior).map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                )}
                <SliderControl label="Motion Intensity" value={config.motionIntensity} min={0.5} max={4} step={0.1} onChange={v => setConfig(p=>({...p, name: 'Custom', motionIntensity: v}))} />
                <SliderControl label="Camera Shake" value={config.cameraShakeIntensity} min={0} max={5} step={0.1} onChange={v => setConfig(p=>({...p, name: 'Custom', cameraShakeIntensity: v}))} />
                <SliderControl label="Smoothing" value={config.smoothingTimeConstant} min={0} max={0.99} step={0.01} onChange={v => setConfig(p=>({...p, name: 'Custom', smoothingTimeConstant: v}))} />
                <SliderControl label="Bar Count" value={config.barCount} min={16} max={512} step={4} onChange={v => setConfig(p=>({...p, name: 'Custom', barCount: v}))} />
                <SliderControl label="Frequency Range Start" value={config.frequencyRangeStart} min={0} max={1} step={0.01} onChange={v => setConfig(p=>({...p, name: 'Custom', frequencyRangeStart: v}))} />
                <SliderControl label="Frequency Range End" value={config.frequencyRangeEnd} min={0} max={1} step={0.01} onChange={v => setConfig(p=>({...p, name: 'Custom', frequencyRangeEnd: v}))} />
                <SliderControl label="Bar Width" value={config.barWidth} min={1} max={10} step={1} onChange={v => setConfig(p=>({...p, name: 'Custom', barWidth: v}))} />
                <SliderControl label="Glow Radius" value={config.glowRadius} min={0} max={50} step={1} onChange={v => setConfig(p=>({...p, name: 'Custom', glowRadius: v}))} />
                <SliderControl label="Logo Size" value={config.logoSize} min={0.1} max={2} step={0.05} onChange={v => setConfig(p=>({...p, name: 'Custom', logoSize: v}))} />
                <ColorControl label="Spectrum 1" value={config.spectrumColor1} onChange={v => setConfig(p=>({...p, name: 'Custom', spectrumColor1: v}))}/>
                <ColorControl label="Spectrum 2" value={config.spectrumColor2} onChange={v => setConfig(p=>({...p, name: 'Custom', spectrumColor2: v}))}/>
                <ColorControl label="Background 1" value={config.bgColor1} onChange={v => setConfig(p=>({...p, name: 'Custom', bgColor1: v}))}/>
                <ColorControl label="Background 2" value={config.bgColor2} onChange={v => setConfig(p=>({...p, name: 'Custom', bgColor2: v}))}/>
                <ColorControl label="Particle Color" value={config.particleColor} onChange={v => setConfig(p=>({...p, name: 'Custom', particleColor: v}))}/>
                <CheckboxControl label="High-Energy FX" checked={config.highEnergyFx} onChange={v => setConfig(p => ({...p, name: 'Custom', highEnergyFx: v}))} />
            </div>
          </div>
        </fieldset>

        {/* Export Section */}
        <div className="p-6 mt-auto border-t border-brand-border bg-brand-surface">
            <fieldset disabled={isGenerating}>
              <h2 className="text-lg font-semibold mb-4 text-brand-primary">Export</h2>
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Aspect Ratio</label>
                      <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full bg-brand-bg border border-brand-border rounded-md px-2 py-2 text-sm">
                          {Object.values(AspectRatio).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                  </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Format</label>
                      <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} className="w-full bg-brand-bg border border-brand-border rounded-md px-2 py-2 text-sm">
                          <option value={ExportFormat.MP4}>MP4</option>
                          <option value={ExportFormat.WebM}>WEBM</option>
                      </select>
                  </div>
              </div>
            </fieldset>
            <button 
              onClick={handleGenerateClick} 
              disabled={isGenerating || !audioFile} 
              className="w-full mt-6 py-3 px-4 bg-brand-primary text-black font-bold rounded-lg text-lg transition-all hover:bg-opacity-80 disabled:bg-brand-border disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Video'}
            </button>
        </div>
      </aside>
    </div>
  );
};

export default App;