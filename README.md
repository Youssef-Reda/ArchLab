# ArchLab: Smartwatch Photoplethysmography (PPG) Simulator

A real-time engineering simulation of optical heart rate sensors. This project models the physics of PPG sensors, signal processing pipelines, and hardware constraints found in wearable technology.

### 🔗 [Live Demo Here](PUT_YOUR_VERCEL_LINK_HERE)

### 🛠 Engineering Concepts Demonstrated
* **Physics Engine:** Simulates light absorption (Beer-Lambert Law) for Green (525nm), Red (660nm), and IR (940nm) wavelengths.
* **Signal Processing:** Implements raw noise generation, DC offset drift, and Motion Artifact simulation.
* **DSP Algorithms:**
    * **Basic:** Zero-crossing detection (susceptible to noise).
    * **DSP:** Low-pass filtering (IIR) to remove high-frequency noise.
    * **ML:** Statistical estimation for signal recovery.
* **Hardware Emulation:** Simulates Reflective vs. Transmissive modes and their impact on Signal-to-Noise Ratio (SNR).

### 💻 Tech Stack
* **Frontend:** React.js, Tailwind CSS
* **Visualization:** Recharts (Custom rendered at 50 FPS)
* **Logic:** Custom JavaScript physics hooks (No external physics libraries)
