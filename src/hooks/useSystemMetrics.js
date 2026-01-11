import { useState, useEffect } from 'react';
import { CONSTANTS } from '../config';

export const useSystemMetrics = (config, simParams) => {
  const [metrics, setMetrics] = useState({
    ramUsage: 0,
    ramTotal: 0,
    cpuUsage: 0,
    powerTotal: 0,
    batteryLifeHours: 0,
    snr: 0
  });
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    // 1. RAM Usage
    const displayRam = (config.display.specs.width * config.display.specs.height * config.display.specs.bitsPerPixel / 8 * 2) / 1024;
    const bufferRam = 20; 
    const algoRam = config.software.id === 'ml_algo' ? 30 : config.software.id === 'dsp_algo' ? 8 : 2;
    const totalRam = displayRam + CONSTANTS.SYSTEM_OVERHEAD_KB + algoRam + bufferRam;

    // 2. CPU Load
    let baseLoad = CONSTANTS.BASE_CALCULATION_MIPS;
    if (config.software.id === 'dsp_algo') baseLoad *= 3; 
    if (config.software.id === 'ml_algo') baseLoad *= 10;
    if (config.display.specs.refreshRate > 30) baseLoad += 2;
    const filterLoad = (100 - simParams.filterCutoff) / 20; 
    const cpuUsagePercent = Math.min(((baseLoad + filterLoad) / (config.mcu.specs.clock / 5)) * 100, 100);

    // 3. Power Consumption
    const displayPower = config.display.specs.powerConsumption * CONSTANTS.DUTY_CYCLE_FACTOR;
    const dutyCycle = config.drive.specs.dutyCycle || 1.0;
    const sensorPower = config.emitters.specs.power + config.afe.specs.power;
    const mcuPower = (cpuUsagePercent / 100) * 12; 
    const totalCurrent_mA = displayPower + sensorPower + mcuPower + 2; 

    // 4. SNR Calculation
    let currentSnr = config.detectors.specs.snr - config.afe.specs.noise;
    currentSnr -= (simParams.noiseLevel * 0.5); 
    currentSnr -= (simParams.motionArtifact * 0.2);
    if (config.software.id === 'dsp_algo') currentSnr += 5;
    if (config.software.id === 'ml_algo') currentSnr += 12;

    // Set State
    setMetrics({
      ramUsage: totalRam,
      ramTotal: config.mcu.specs.ram,
      cpuUsage: cpuUsagePercent,
      powerTotal: totalCurrent_mA,
      batteryLifeHours: config.battery.specs.capacity / totalCurrent_mA,
      snr: Math.max(0, currentSnr)
    });

    // Generate Alerts
    const newAlerts = [];
    if (totalRam > config.mcu.specs.ram) newAlerts.push({ type: 'error', msg: 'RAM Overflow! System Crash.' });
    if (cpuUsagePercent > 90) newAlerts.push({ type: 'error', msg: 'CPU Overload! Dropping frames.' });
    if (config.software.id === 'ml_algo' && !config.mcu.specs.fpu) newAlerts.push({ type: 'warning', msg: 'ML on Cortex-M0 is extremely slow.' });
    setAlerts(newAlerts);

  }, [config, simParams]);

  return { metrics, alerts };
};