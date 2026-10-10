# 🏙️ CityTwin AI — Kochi Command Center

CityTwin AI (Sentinel AI) is a next-generation, high-performance **Smart City Command Center and Digital Twin Dashboard** for Kochi, Kerala. It combines real-time sensor simulation, Vision AI surveillance analytics, and multi-agent AI reasoning to monitor, simulate, and optimize urban infrastructure.

[![CityTwin AI Dashboard](public/citytwin-hero-light.png)](https://citytwinai.vercel.app/)

---

## ✨ Features & Capabilities

### 🚑 Emergency Green Corridor & Ambulance Priority
- **Automatic Signal Preemption**: Instantly turns traffic signals green along designated emergency routes when an ambulance, police unit, or fire truck approaches.
- **Green Corridor Route Optimization**: Calculates fastest routes to major hospitals (e.g. Ernakulam Medical Trust, Aster Medcity, Amrita Hospital) while clearing downstream intersection bottlenecks.

### 🚦 Reinforcement-Learning Adaptive Traffic Signals
- **Dynamic Phase Allocation**: Automatically adjusts green light timing (from 15s to 60s) based on live vehicle queue lengths at key junctions like Kundannoor, Edappally, Palarivattom, and Kaloor.
- **Manual & AI Mode Toggle**: Allows operators to switch individual junctions between fixed-cycle timing and adaptive AI signal control.

### 📹 Vision AI CCTV Analytics
- **Live Stream Object Detection**: Tracks cars, buses, trucks, motorcycles, and pedestrians in real-time across key surveillance feeds.
- **Automatic Incident Recognition**: Instantly detects stalled vehicles, lane blockages, and traffic collisions (e.g., stalled truck alerts on CAM-18).

### 💬 Sentinel AI Copilot (Powered by Google Gemini)
- **Multi-Agent Reasoning**: Natural language command assistant that queries real-time city state, evaluates risk metrics, and triggers automated emergency workflows.
- **Local Fallback**: Works seamlessly with simulation mode if an API key is not configured.

### 🌐 Interactive Digital Twin Map & Historical Replay
- **Kochi Geo-Visualizer**: Leaflet & OpenStreetMap powered interactive digital twin map featuring live pulsing incident pins categorized by severity (Critical, Elevated, Warning), traffic flow corridors, flood polygons, and Kochi Metro transit lines.
- **Incident Playback**: Step-by-step historic time-series replay to analyze past traffic bottlenecks and emergency dispatch events.

### 🌊 Flood Monitoring & Predictive Risk Engine
- **Water Level Sensor Network**: Real-time depth tracking along Marine Drive, Edappally, and coastal corridors.
- **Rainfall Risk Trigger**: Predicts elevated flood risks based on monsoon precipitation thresholds and tide levels.

### 👥 Citizen Engagement & Executive Reporting
- **Citizen Report Portal**: Interface for residents to submit reports on potholes, waterlogging, or power outages with confidence scoring.
- **Executive Summaries**: Auto-generates downloadable operational briefs for city directors and department heads.

### 🎮 Disaster Simulation Sandbox
- **Interactive Stress-Testing**: Allows city operators to simulate severe monsoon downpours, rush-hour peak traffic, or major bridge blockages to evaluate infrastructure resilience.

---

## 🛠️ Technology Stack

- **Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React 19 + Vite + Nitro Server Engine)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Vanilla CSS for premium dark-themed glassmorphic UI components
- **Animations**: [Framer Motion](https://www.framer.com/motion/) & CSS keyframes for fluid, interactive micro-transitions
- **Charts & Data**: [Recharts](https://recharts.org/) for real-time traffic and flood analytics
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v18 or higher) installed.

### Installation

1. Clone or download the repository:
   ```bash
   git clone <repository-url>
   cd sentinel-ai-main
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Set up the environment variables:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - (Optional) Add your Google Gemini API key to enable the AI Copilot:
     ```env
     VITE_GEMINI_API_KEY="your_api_key_here"
     ```

### Run Locally

Start the local development server:
```bash
npm run dev
```
Open your browser and navigate to **`http://localhost:8081/`** (or the port specified in your console).

---

## ☁️ Deployment on Vercel

CityTwin AI is built using TanStack Start and Nitro, meaning it supports **Vercel** out-of-the-box with zero extra configuration.

### Deployment Steps:

1. **Push to GitHub**:
   Initialize a git repo, commit the files, and push them to your GitHub repository.

2. **Import to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/new).
   - Import your GitHub repository.
   - Vercel will automatically detect the **TanStack Start** framework preset.

3. **Configure Environment Variables (Optional)**:
   Add your Gemini API Key in Vercel settings under **Environment Variables**:
   * `VITE_GEMINI_API_KEY` = `your_gemini_api_key`

4. **Click Deploy**:
   Vercel will build and deploy the application. It will automatically route server-side functions and assets.

---

## 📄 License

This project is licensed under the MIT License.
