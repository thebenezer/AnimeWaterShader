
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class App {
  private cube: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private UNIFORMS = {
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth,window.innerHeight) }
  };

  constructor() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true,precision: 'highp' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.pixelRatio = Math.min(window.devicePixelRatio,2);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    this.camera.position.set(-50, 30, -50);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.screenSpacePanning = true
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshPhongMaterial({ color: 0x65f442 });
    this.cube = new THREE.Mesh(geometry, material);
    this.init();
  }


  addSky() {
    
    const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({ color: 0xdddddd,side: THREE.BackSide, fog: false });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);
  }
  addFog() {
    const fogColor = 0xdddddd;
    const fogDensity = 0.01;
    this.scene.fog = new THREE.FogExp2(fogColor, fogDensity);
  }

  init() {
    this.scene.add(this.cube);

    // Directional Light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 100);
    this.scene.add(directionalLight);

    // Hemisphere Light
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x0000ff, 0.6);
    this.scene.add(hemisphereLight);

    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    this.camera.position.z = 5;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.addSky(); // Add the sky
    this.addFog(); // Add the fog
    this.animate();
    this.loadModels();
    this.addEventListeners();
  }

  loadModels() {

    const starTexture = new THREE.TextureLoader().load('stars_1.jpg');
    starTexture.wrapS = THREE.RepeatWrapping;
    starTexture.wrapT = THREE.RepeatWrapping;

    const lakeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        u_time: this.UNIFORMS.u_time,
        u_resolution: this.UNIFORMS.u_resolution,
        u_starTexture: { value: starTexture }
      },
      vertexShader: `
      varying vec2 vUv;
      varying vec4 vScreenPos;
      varying vec3 vVertexPos;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        vScreenPos = gl_Position;
        vVertexPos = position;
      }
      `,
      fragmentShader: `
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform sampler2D u_starTexture;

      varying vec2 vUv;
      varying vec4 vScreenPos;
      varying vec3 vVertexPos;

      #ifdef GL_ES
      precision mediump float;
      #endif

      vec2 random2( vec2 p ) {
          return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
      }

      // Classic Perlin 3D Noise
      float rand(vec2 co) {
          return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
      }

      // Function to generate 2D Perlin noise
      float noise(vec2 uv) {
          vec2 i = floor(uv);
          vec2 f = fract(uv);

          // Smooth the fragment position
          vec2 smoothF = f * f * (3.0 - 2.0 * f);

          // Get noise values at the corners of the fragment position
          float a = rand(i);
          float b = rand(i + vec2(1.0, 0.0));
          float c = rand(i + vec2(0.0, 1.0));
          float d = rand(i + vec2(1.0, 1.0));

          // Interpolate between noise values
          float x1 = mix(a, b, smoothF.x);
          float x2 = mix(c, d, smoothF.x);

          return mix(x1, x2, smoothF.y);
      }

      void main() {
        // ************* Distort the UVs with noise *******************

        vec2 distortedUV = vUv;
        // Scale
        distortedUV *= 20.;

        // Adjust the noise scale to increase localization
        float noiseScale = 10.0;
    
        float timeFactor = u_time * 0.5;
    
        // Generate localized noise by scaling UV before applying noise
        float n = noise((distortedUV - 0.5) * noiseScale + timeFactor);
    
        // Adjust distortion strength and localize effect by scaling the noise contribution
        distortedUV += (n - 0.5) * 0.5;

        // ************* Create a Voronoi pattern *******************

        float voronoiPattern = 0.0;

        // Tile the space
        vec2 i_st = floor(distortedUV);
        vec2 f_st = fract(distortedUV);

        float m_dist = 1.;  // minimum distance

        for (int y= -1; y <= 1; y++) {
            for (int x= -1; x <= 1; x++) {
                // Neighbor place in the grid
                vec2 neighbor = vec2(float(x),float(y));

                // Random position from current + neighbor place in the grid
                vec2 point = random2(i_st + neighbor);

          // Animate the point
                point = 0.5 + 0.5*sin(u_time *0.5 + 6.2831*point);

          // Vector between the pixel and the point
                vec2 diff = neighbor + point - f_st;

                // Distance to the point
                float dist = length(diff);

                // Keep the closer distance
                m_dist = min(m_dist, dist);
            }
        }
        // Draw the min distance (distance field)
        voronoiPattern += m_dist;

        // ************* mix water colors *******************

        vec3 waterColor = vec3(0.0, 0.80, 0.80);
        vec3 highLightColor = vec3(0.90, 0.90, 1.0);

        vec3 color = mix(waterColor, highLightColor, voronoiPattern);

        // ************* Add stars to screen coordinates *******************

        float aspectRatio = u_resolution.x / u_resolution.y;
        vec2 screenUV = (vScreenPos.xy / vScreenPos.w + 1.0) * 0.5;
        screenUV.x *= aspectRatio;

        // float starScale = clamp(0.0,20.,20.- distance(vVertexPos, cameraPosition));
        float starScale = 2.;
        screenUV = screenUV * vec2(1.5,2.) * starScale; // Adjust the scaling of the noise texture

        // Scroll screen coordinates x like 12 frame animation
        screenUV.x += (ceil(u_time*5.) * 0.3);
        
        float stars = texture2D(u_starTexture, screenUV).r;

        // ************* Add emissive glow *******************

        float emissive = smoothstep(0.70,0.90, voronoiPattern);
        float glisten = mix(0.0, stars,emissive) *2.;

        color += glisten;
        gl_FragColor = vec4(color , 0.7);
      }

      `,
    });

    const riverTexture = new THREE.TextureLoader().load('peter-burroughs-tilingwater.jpg');
    riverTexture.wrapS = THREE.RepeatWrapping;
    riverTexture.wrapT = THREE.RepeatWrapping;
    const riverMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_time: this.UNIFORMS.u_time,
        u_texture: { value: riverTexture},
        u_scrollSpeed: { value: 0.2}
      },
      vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
      `,
      fragmentShader: `
      uniform float u_time;
      uniform float u_scrollSpeed;
      uniform sampler2D u_texture;
      varying vec2 vUv;
      void main() {
        vec2 scaledUV = vec2(vUv.x * 10.0, vUv.y * 2.0);
        vec2 scrollingUV = vec2(scaledUV.x + u_time * u_scrollSpeed, scaledUV.y);
        vec3 texture = texture2D(u_texture, scrollingUV).rgb;
        gl_FragColor = vec4(texture, 1.0);
      }
      `,
    });
    const loader = new GLTFLoader();
    loader.load(
      'demoScene.glb',
      (gltf) => {
        const root = gltf.scene;
        gltf.scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            if (child.name === 'Lake'){
              (child as THREE.Mesh).material = lakeMaterial;
            }
            if (child.name === 'River'){
              (child as THREE.Mesh).material = riverMaterial;
            }
          }
        });
        this.scene.add(root);
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.log('An error happened');
      }
    );
  }

  animate = () => {
    const delta = this.clock.getDelta();
    this.UNIFORMS.u_time.value += delta;

    requestAnimationFrame(this.animate);

    this.cube.rotation.x += 0.01;
    this.cube.rotation.y += 0.01;

    this.renderer.render(this.scene, this.camera);
  }

  addEventListeners() {
    window.addEventListener('resize', () => {
      this.UNIFORMS.u_resolution.value.x = window.innerWidth;
      this.UNIFORMS.u_resolution.value.y = window.innerHeight;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
}

new App();
