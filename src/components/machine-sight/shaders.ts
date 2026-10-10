// Custom GLSL Shaders for Machine Sight: Clay City, LIDAR, Semantic Segments, Teal Depth & Pixelated Grid Dissolve
import * as THREE from "three";

export const MultiSensorShader = {
  uniforms: {
    uZoneCenter: { value: new THREE.Vector2(0, 0) },
    uZoneRadius: { value: 65.0 },
    uSensorMode: { value: 0 }, // 0: LIDAR, 1: SEGMENTS, 2: DEPTH
    uTime: { value: 0.0 },
    uSemanticType: { value: 0 }, // 0: Ground, 1: Road, 2: Sidewalk, 3: Building, 4: Car, 5: Ambulance, 6: Signal
    uClayBaseColor: { value: new THREE.Color("#e5e3df") },
    uSegmentColor: { value: new THREE.Color("#334155") },
    uLightDir: { value: new THREE.Vector3(0.4, 0.9, 0.35).normalize() },
  },

  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vCameraDistance;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vec4 viewPos = viewMatrix * worldPos;
      vCameraDistance = -viewPos.z;
      gl_Position = projectionMatrix * viewPos;
    }
  `,

  fragmentShader: `
    uniform vec2 uZoneCenter;
    uniform float uZoneRadius;
    uniform int uSensorMode; // 0: LIDAR, 1: SEGMENTS, 2: DEPTH
    uniform float uTime;
    uniform int uSemanticType;
    uniform vec3 uClayBaseColor;
    uniform vec3 uSegmentColor;
    uniform vec3 uLightDir;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vCameraDistance;

    // Ordered 4x4 Bayer Matrix for authentic pixelated / dithered square dissolve
    float bayerDither(vec2 pos) {
      vec2 gridPos = floor(pos / 2.2);
      float x = mod(gridPos.x, 4.0);
      float y = mod(gridPos.y, 4.0);
      
      // Bayer 4x4 matrix normalized to 0.0 .. 1.0
      float m = 0.0;
      if (y == 0.0) {
        if (x == 0.0) m = 0.0; else if (x == 1.0) m = 8.0; else if (x == 2.0) m = 2.0; else m = 10.0;
      } else if (y == 1.0) {
        if (x == 0.0) m = 12.0; else if (x == 1.0) m = 4.0; else if (x == 2.0) m = 14.0; else m = 6.0;
      } else if (y == 2.0) {
        if (x == 0.0) m = 3.0; else if (x == 1.0) m = 11.0; else if (x == 2.0) m = 1.0; else m = 9.0;
      } else {
        if (x == 0.0) m = 15.0; else if (x == 1.0) m = 7.0; else if (x == 2.0) m = 13.0; else m = 5.0;
      }
      return m / 16.0;
    }

    void main() {
      // Distance from AI Vision Zone Center
      float distToCenter = length(vWorldPosition.xz - uZoneCenter);

      // --- CLAY SHADING (Outside Zone) ---
      float NdotL = max(0.2, dot(vNormal, uLightDir));
      float topLight = max(0.0, vNormal.y) * 0.25;
      vec3 clayColor = uClayBaseColor * (NdotL * 0.7 + topLight + 0.35);

      if (uSemanticType == 0) {
        clayColor = vec3(0.92, 0.91, 0.89); // Pale ground
      } else if (uSemanticType == 1) {
        clayColor = vec3(0.85, 0.84, 0.82); // Road
      } else if (uSemanticType == 2) {
        clayColor = vec3(0.89, 0.88, 0.86); // Sidewalk
      } else if (uSemanticType == 3) {
        clayColor = vec3(0.98, 0.97, 0.96) * (NdotL * 0.65 + 0.35); // White clay buildings
      }

      // --- INSIDE VISION ZONE SENSOR MODES ---
      vec3 sensorColor = vec3(0.0);

      if (uSensorMode == 0) {
        // --- 1. LIDAR VIEW ---
        // Dark navy base
        vec3 lidarBase = vec3(0.02, 0.05, 0.10);

        // Concentric scan rings radiating outward
        float scanWave = sin(distToCenter * 0.7 - uTime * 6.0);
        float ringIntensity = smoothstep(0.7, 0.98, scanWave) * 0.9;

        // Subtle structural grid on ground & buildings
        vec2 uvGrid = fract(vWorldPosition.xz * 0.4);
        float gridLine = (step(0.92, uvGrid.x) + step(0.92, uvGrid.y)) * 0.35;

        // Glowing edge highlights
        vec3 lidarEdge = vec3(0.0, 0.85, 1.0);
        if (uSemanticType == 1) lidarEdge = vec3(0.05, 0.6, 0.8); // Road
        if (uSemanticType == 4) lidarEdge = vec3(0.2, 0.9, 0.6);  // Traffic
        if (uSemanticType == 5) lidarEdge = vec3(1.0, 0.4, 0.1);  // Emergency
        if (uSemanticType == 6) lidarEdge = vec3(1.0, 0.85, 0.0); // Signal

        sensorColor = lidarBase + lidarEdge * (ringIntensity * 0.75 + gridLine + 0.1);

        if (uSemanticType == 3) {
          float heightFactor = clamp(vWorldPosition.y / 35.0, 0.0, 1.0);
          sensorColor += mix(vec3(0.01, 0.04, 0.09), vec3(0.04, 0.35, 0.55), heightFactor);
        }

      } else if (uSensorMode == 1) {
        // --- 2. SEMANTIC SEGMENTS VIEW ---
        vec3 segBase = uSegmentColor;

        if (uSemanticType == 0) segBase = vec3(0.09, 0.13, 0.19); // Ground
        else if (uSemanticType == 1) segBase = vec3(0.14, 0.18, 0.25); // Road
        else if (uSemanticType == 2) segBase = vec3(0.25, 0.31, 0.40); // Sidewalk
        else if (uSemanticType == 3) {
          float floorBand = mod(vWorldPosition.y, 3.2) < 0.35 ? 0.85 : 1.0;
          segBase = vec3(0.20, 0.25, 0.35) * floorBand;
        } else if (uSemanticType == 4) {
          segBase = vec3(0.05, 0.65, 0.95); // Traffic Cars
        } else if (uSemanticType == 5) {
          segBase = vec3(0.95, 0.35, 0.05); // Emergency Ambulance
        } else if (uSemanticType == 6) {
          segBase = vec3(0.1, 0.9, 0.4); // Signal
        }

        sensorColor = segBase * (NdotL * 0.45 + 0.65);

      } else {
        // --- 3. DEPTH CONTOUR GRADIENT VIEW (Exact Video Reference) ---
        // Topographic depth & height contours in teal and midnight blue
        float depthVal = clamp(vCameraDistance / 260.0, 0.0, 1.0);
        float heightVal = clamp(vWorldPosition.y / 45.0, 0.0, 1.0);

        vec3 deepTeal = vec3(0.01, 0.12, 0.18);
        vec3 midCyan = vec3(0.04, 0.55, 0.62);
        vec3 brightTeal = vec3(0.35, 0.95, 0.85);

        vec3 depthGradient = mix(deepTeal, midCyan, 1.0 - depthVal);
        depthGradient = mix(depthGradient, brightTeal, heightVal * 0.65);

        // Topographic Contour Lines hugging the geometry
        float contourDist = distToCenter * 0.4 - uTime * 0.5;
        float contourWave = sin(vWorldPosition.y * 3.0 + contourDist * 3.14159);
        float contourLine = smoothstep(0.82, 0.96, contourWave) * 0.75;

        sensorColor = depthGradient + vec3(contourLine * 0.4, contourLine * 0.85, contourLine);
      }

      // --- PIXELATED / DITHERED SQUARE GRID DISSOLVE BOUNDARY ---
      float dither = bayerDither(vWorldPosition.xz);
      float edgeRange = 10.0;
      float transition = clamp((distToCenter - (uZoneRadius - edgeRange)) / edgeRange, 0.0, 1.0);
      
      // Binary pixelated mask
      float mask = step(transition, dither);

      // Subtle border pixel glow
      float borderDist = abs(distToCenter - uZoneRadius);
      vec3 borderGlowColor = uSensorMode == 0 ? vec3(0.0, 0.85, 1.0) : (uSensorMode == 1 ? vec3(0.9, 0.4, 0.1) : vec3(0.2, 0.95, 0.8));
      float borderGlow = smoothstep(4.0, 0.0, borderDist) * 0.4;

      vec3 finalColor = mix(clayColor, sensorColor, mask);
      if (mask > 0.5) {
        finalColor += borderGlowColor * borderGlow;
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};
