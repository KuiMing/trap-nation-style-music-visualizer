export enum DynamicStyle {
  PyroBurst = 'Pyro Burst',
  GlacialShards = 'Glacial Shards',
  QuantumEntanglement = 'Quantum Entanglement',
  CelestialBloom = 'Celestial Bloom',
}

export enum ParticleBehavior {
    Static = 'Static',
    Gravity = 'Gravity',
    AntiGravity = 'Anti-Gravity',
    RadialOut = 'Radial Out',
    VortexIn = 'Vortex In',
}

export enum BackgroundBehavior {
    Static = 'Static',
    SlowPan = 'Slow Pan',
    GentleZoom = 'Gentle Zoom',
    AudioPulse = 'Audio Pulse',
}

export enum LogoBehavior {
    Static = 'Static',
    Pulse = 'Pulse',
    Shake = 'Shake',
    Float = 'Float',
}

export enum AspectRatio {
  SixteenNine = '16:9',
  NineSixteen = '9:16',
}

export enum ExportFormat {
    MP4 = 'video/mp4',
    WebM = 'video/webm',
}

export interface VisualizerConfig {
  dynamicStyle: DynamicStyle;
  motionIntensity: number;
  cameraShakeIntensity: number;
  barCount: number;
  barWidth: number;
  glowRadius: number;
  starSpikes: number;
  starInnerRadius: number;
  spectrumColor1: string;
  spectrumColor2: string;
  bgColor1: string;
  bgColor2: string;
  particleColor: string;
  logoSize: number;
  highEnergyFx: boolean;
  smoothingTimeConstant: number;
  frequencyRangeStart: number;
  frequencyRangeEnd: number;
  particleBehavior: ParticleBehavior;
  backgroundBehavior: BackgroundBehavior;
  logoBehavior: LogoBehavior;
}

export interface Preset extends VisualizerConfig {
    name: string;
}