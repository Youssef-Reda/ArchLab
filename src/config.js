import { Layout, Droplet, Eye, Activity, Cpu, Layers, Battery } from 'lucide-react';

export const CONSTANTS = {
  SYSTEM_OVERHEAD_KB: 5,
  DUTY_CYCLE_FACTOR: 0.7,
  BASE_CALCULATION_MIPS: 0.5
};

export const STAGES = {
  DISPLAY: {
    id: 'display',
    title: 'Display',
    icon: Layout,
    options: [
      { 
        id: 'oled_mono', 
        name: 'Monochrome OLED 0.96"', 
        specs: { width: 128, height: 64, type: 'OLED', powerConsumption: 10, cost: 5, refreshRate: 30, bitsPerPixel: 1 },
        desc: 'Ultra-low power, high contrast, limited information density.'
      },
      { 
        id: 'tft_color', 
        name: 'TFT LCD 1.69"', 
        specs: { width: 240, height: 280, type: 'LCD', powerConsumption: 40, cost: 8, refreshRate: 60, bitsPerPixel: 16 },
        desc: 'Standard color display, high refresh rate, requires backlight.'
      },
      { 
        id: 'amoled', 
        name: 'AMOLED 1.4"', 
        specs: { width: 454, height: 454, type: 'AMOLED', powerConsumption: 60, cost: 25, refreshRate: 60, bitsPerPixel: 24 },
        desc: 'Premium vibrant colors, true blacks, high power consumption.'
      }
    ]
  },
  EMITTERS: {
    id: 'emitters',
    title: 'Optical Emitters',
    icon: Droplet,
    options: [
      { id: 'green_only', name: 'Green Only (525nm)', specs: { channels: 1, power: 10 }, desc: 'Good for HR during motion. Cannot measure SpO2.' },
      { id: 'red_ir', name: 'Red + IR (660/940nm)', specs: { channels: 2, power: 15 }, desc: 'Required for SpO2. Susceptible to motion artifacts.' },
      { id: 'multi', name: 'Multi-Wavelength', specs: { channels: 3, power: 25 }, desc: 'Best of both worlds. High accuracy & SpO2 support.' }
    ]
  },  
  DRIVE: {
    id: 'drive',
    title: 'LED Drive Mode',
    icon:  Activity, // You can import 'Zap' or 'Activity'
    options: [
      { 
        id: 'continuous', 
        name: 'Continuous Mode', 
        specs: { dutyCycle: 1.0, samplingRate: 'High' }, 
        desc: 'LED is always ON. Highest signal fidelity, but drains battery rapidly.' 
      },
      { 
        id: 'pulsed_100hz', 
        name: 'Pulsed Mode', 
        specs: { dutyCycle: 0.1, samplingRate: 'Med' }, 
        desc: 'Flashes LED to save power. Good compromise for daily tracking.' 
      }
      //, { 
      //   id: 'pulsed_25hz', 
      //   name: 'Low Power (25Hz)', 
      //   specs: { dutyCycle: 0.02, samplingRate: 'Low' }, 
      //   desc: 'Extreme power saving. Signal looks "stepped". Poor motion handling.' 
      // }
    ]
  },
  DETECTORS: {
    id: 'detectors',
    title: 'Photodetectors',
    icon: Eye,
    options: [
      { id: 'single_pd', name: 'Single Photodiode', specs: { snr: 20 }, desc: 'Basic signal reception. Prone to noise.' },
      { id: 'dual_pd', name: 'Dual PD (Differential)', specs: { snr: 30 }, desc: 'Cancels ambient noise. Better signal quality.' },
      { id: 'array_pd', name: 'PD Array (Central)', specs: { snr: 45 }, desc: 'Maximum light capture. High SNR, expensive.' }
    ]
  },
  AFE: {
    id: 'afe',
    title: 'Analog Front End',
    icon: Activity,
    options: [
      { id: 'discrete', name: 'Discrete Op-Amp', specs: { noise: 5, power: 2 }, desc: 'Simple, cheap, but noisy baseline.' },
      { id: 'tia_amp', name: 'TIA (Transimpedance)', specs: { noise: 2, power: 8, adcBits: 18 }, desc: 'Converts current to voltage with high gain. Essential for photodiodes.'},
      { id: 'integrated', name: 'Integrated AFE', specs: { noise: 1, power: 5, adcBits: 24 }, desc: 'Clinical grade. 24-bit ADC handles tiny signal variations.' }
    ]
  },
  MCU: {
    id: 'mcu',
    title: 'Microcontroller',
    icon: Cpu,
    options: [
      { id: 'basic', name: 'Basic (Cortex M0)', specs: { clock: 48, flash: 128, ram: 16, fpu: false }, desc: 'Low power, struggles with complex math.' },
      { id: 'standard', name: 'Standard (Cortex M4)', specs: { clock: 64, flash: 512, ram: 256, fpu: true }, desc: 'Balanced. Has FPU for SpO2 algorithms.' },
      { id: 'high_perf', name: 'High Perf (Cortex M33)', specs: { clock: 120, flash: 1024, ram: 512, fpu: true }, desc: 'Powerful graphics & DSP. Power hungry.' }
    ]
  },
  SOFTWARE: {
    id: 'software',
    title: 'Software',
    icon: Layers,
    options: [
      { id: 'basic_algo', name: 'Basic Peak Detect', specs: { complexity: 'Low' }, desc: 'Simple zero-crossing. Fails with motion.' },
      { id: 'dsp_algo', name: 'DSP Filtering', specs: { complexity: 'Medium' }, desc: 'FIR/IIR filters. Clean signal, moderate CPU load.' },
      { id: 'ml_algo', name: 'AI/ML Estimation', specs: { complexity: 'High' }, desc: 'Neural network reconstruction. High CPU load.' }
    ]
  },
  BATTERY: {
    id: 'battery',
    title: 'Battery',
    icon: Battery,
    options: [
      { id: 'lipo_small', name: 'LiPo Small', specs: { capacity: 190 }, desc: 'Slim profile. Very compact.' },
      { id: 'lipo_mid', name: 'LiPo Mid', specs: { capacity: 380 }, desc: 'Slim profile, typical for fitness bands.' },
      { id: 'lipo_large', name: 'LiPo Large', specs: { capacity: 500 }, desc: 'Bulky, but longer life.' }
    ]
  }
};