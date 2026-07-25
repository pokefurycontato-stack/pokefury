import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const STORAGE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/models-3d';

export class Overworld3D {
    constructor(game) {
        this.game = game;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
        this.keys = {};
        this.playerSpeed = 5;
        this.isMoving = false;
        this.lastDirection = 'down';
        this.animActions = {};
        this.currentAction = null;
        this.groundSize = 100;
        this.encounterCooldown = 0;
        this.ready = false;
        this.trees = [];
        this.water = [];

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 30, 80);

        const aspect = 960 / 640;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(960, 640);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        const canvas = this.renderer.domElement;
        canvas.id = 'overworld-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '0';
        canvas.style.display = 'none';
        document.getElementById('game-container').prepend(canvas);

        this.setupLights();
        this.createGround();
        this.createTrees();
        this.createWater();
        this.createDecorations();
        this.loadPlayer();
        this.setupInput();

        this.animate();
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff5e6, 1.2);
        sun.position.set(20, 30, 10);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 30;
        sun.shadow.camera.bottom = -30;
        this.scene.add(sun);
        this.sun = sun;

        const hemi = new THREE.HemisphereLight(0x87ceeb, 0x228B22, 0.3);
        this.scene.add(hemi);
    }

    createGround() {
        const grassMat = new THREE.MeshLambertMaterial({ color: 0x3d8b37 });
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(this.groundSize, this.groundSize),
            grassMat
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const pathMat = new THREE.MeshLambertMaterial({ color: 0xc4a87c });
        const path = new THREE.Mesh(
            new THREE.PlaneGeometry(3, this.groundSize),
            pathMat
        );
        path.rotation.x = -Math.PI / 2;
        path.position.y = 0.01;
        this.scene.add(path);

        const darkGrass = new THREE.MeshLambertMaterial({ color: 0x2d6b27 });
        for (let i = 0; i < 20; i++) {
            const patch = new THREE.Mesh(
                new THREE.CircleGeometry(1.5 + Math.random() * 2, 8),
                darkGrass
            );
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(
                (Math.random() - 0.5) * this.groundSize * 0.8,
                0.02,
                (Math.random() - 0.5) * this.groundSize * 0.8
            );
            this.scene.add(patch);
        }
    }

    createTrees() {
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
        const leafMats = [
            new THREE.MeshLambertMaterial({ color: 0x228B22 }),
            new THREE.MeshLambertMaterial({ color: 0x2e8b2e }),
            new THREE.MeshLambertMaterial({ color: 0x1a7a1a })
        ];

        for (let i = 0; i < 40; i++) {
            const x = (Math.random() - 0.5) * this.groundSize * 0.85;
            const z = (Math.random() - 0.5) * this.groundSize * 0.85;

            if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;

            const group = new THREE.Group();
            group.position.set(x, 0, z);

            const trunkH = 1.5 + Math.random() * 1;
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.2, trunkH, 6),
                trunkMat
            );
            trunk.position.y = trunkH / 2;
            trunk.castShadow = true;
            group.add(trunk);

            const leafMat = leafMats[Math.floor(Math.random() * leafMats.length)];
            const leafR = 1 + Math.random() * 0.8;
            const leaves = new THREE.Mesh(
                new THREE.SphereGeometry(leafR, 8, 6),
                leafMat
            );
            leaves.position.y = trunkH + leafR * 0.6;
            leaves.castShadow = true;
            group.add(leaves);

            this.scene.add(group);
            this.trees.push({ x, z, r: 0.8 });
        }
    }

    createWater() {
        const waterMat = new THREE.MeshLambertMaterial({
            color: 0x3399ff,
            transparent: true,
            opacity: 0.6
        });

        const pond = new THREE.Mesh(
            new THREE.CircleGeometry(4, 16),
            waterMat
        );
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(15, 0.05, -10);
        this.scene.add(pond);
        this.water.push({ x: 15, z: -10, r: 4 });

        const pond2 = new THREE.Mesh(
            new THREE.CircleGeometry(3, 16),
            waterMat
        );
        pond2.rotation.x = -Math.PI / 2;
        pond2.position.set(-20, 0.05, 8);
        this.scene.add(pond2);
        this.water.push({ x: -20, z: 8, r: 3 });
    }

    createDecorations() {
        const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });

        for (let i = 0; i < 15; i++) {
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.5, 0),
                rockMat
            );
            rock.position.set(
                (Math.random() - 0.5) * this.groundSize * 0.7,
                0.2,
                (Math.random() - 0.5) * this.groundSize * 0.7
            );
            rock.castShadow = true;
            this.scene.add(rock);
        }

        const flowerColors = [0xff69b4, 0xffd700, 0xff6347, 0x9370db, 0xffffff];
        for (let i = 0; i < 30; i++) {
            const flower = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 4, 4),
                new THREE.MeshLambertMaterial({ color: flowerColors[i % flowerColors.length] })
            );
            flower.position.set(
                (Math.random() - 0.5) * this.groundSize * 0.6,
                0.1,
                (Math.random() - 0.5) * this.groundSize * 0.6
            );
            this.scene.add(flower);
        }
    }

    async loadPlayer() {
        const loader = new GLTFLoader();

        const gender = this.game.playerGender || 'male';
        const modelUrl = `${STORAGE_URL}/player/player-${gender}.glb`;

        try {
            const gltf = await new Promise((resolve, reject) => {
                loader.load(modelUrl, resolve, undefined, reject);
            });

            this.player = gltf.scene;
            this.player.scale.set(0.012, 0.012, 0.012);
            this.player.position.set(0, 0, 0);
            this.player.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                }
            });
            this.scene.add(this.player);

            this.mixer = new THREE.AnimationMixer(this.player);
            const clips = gltf.animations;

            const findClip = (names) => {
                for (const name of names) {
                    const c = clips.find(a => a.name === name);
                    if (c) return c;
                }
                return null;
            };

            const idleClip = findClip(['Idle', 'Unarmed_Idle']);
            const walkClip = findClip(['Walking_A', 'Walking_B', 'Walking_C']);
            const runClip = findClip(['Running_A', 'Running_B']);

            if (idleClip) {
                this.animActions.idle = this.mixer.clipAction(idleClip);
                this.animActions.idle.setLoop(THREE.LoopRepeat);
            }
            if (walkClip) {
                this.animActions.walk = this.mixer.clipAction(walkClip);
                this.animActions.walk.setLoop(THREE.LoopRepeat);
            }
            if (runClip) {
                this.animActions.run = this.mixer.clipAction(runClip);
                this.animActions.run.setLoop(THREE.LoopRepeat);
            }

            if (this.animActions.idle) {
                this.currentAction = this.animActions.idle;
                this.currentAction.play();
            }

            this.ready = true;
            console.log('[Overworld3D] Player model loaded:', gender);
        } catch (err) {
            console.error('[Overworld3D] Failed to load player model:', err);
            this.createFallbackPlayer();
        }
    }

    createFallbackPlayer() {
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2196F3 });
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdbac });

        const group = new THREE.Group();

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), bodyMat);
        body.position.y = 0.8;
        group.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), skinMat);
        head.position.y = 1.45;
        group.add(head);

        const legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6), legMat);
        legL.position.set(-0.12, 0.25, 0);
        group.add(legL);
        const legR = legL.clone();
        legR.position.x = 0.12;
        group.add(legR);

        this.player = group;
        this.scene.add(this.player);
        this.ready = true;
    }

    switchAnimation(name) {
        if (!this.animActions[name]) return;
        if (this.currentAction === this.animActions[name]) return;

        if (this.currentAction) {
            this.currentAction.fadeOut(0.2);
        }

        this.currentAction = this.animActions[name];
        this.currentAction.reset().fadeIn(0.2).play();
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    checkCollision(x, z) {
        for (const tree of this.trees) {
            const dx = x - tree.x;
            const dz = z - tree.z;
            if (dx * dx + dz * dz < tree.r * tree.r) return true;
        }
        for (const pond of this.water) {
            const dx = x - pond.x;
            const dz = z - pond.z;
            if (dx * dx + dz * dz < pond.r * pond.r) return true;
        }
        return false;
    }

    update() {
        if (!this.ready || !this.player) return;

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        if (this.mixer) {
            this.mixer.update(delta);
        }

        const speed = this.keys['shift'] ? this.playerSpeed * 1.8 : this.playerSpeed;
        let dx = 0, dz = 0;
        let moving = false;

        if (this.keys['w'] || this.keys['arrowup']) { dz = -1; this.lastDirection = 'up'; moving = true; }
        if (this.keys['s'] || this.keys['arrowdown']) { dz = 1; this.lastDirection = 'down'; moving = true; }
        if (this.keys['a'] || this.keys['arrowleft']) { dx = -1; this.lastDirection = 'left'; moving = true; }
        if (this.keys['d'] || this.keys['arrowright']) { dx = 1; this.lastDirection = 'right'; moving = true; }

        if (dx !== 0 && dz !== 0) {
            dx *= 0.707;
            dz *= 0.707;
        }

        const newX = this.player.position.x + dx * speed * delta;
        const newZ = this.player.position.z + dz * speed * delta;

        const halfGround = this.groundSize / 2 - 2;
        const clampedX = Math.max(-halfGround, Math.min(halfGround, newX));
        const clampedZ = Math.max(-halfGround, Math.min(halfGround, newZ));

        if (!this.checkCollision(clampedX, clampedZ)) {
            this.player.position.x = clampedX;
            this.player.position.z = clampedZ;
        }

        const rotY = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
        const targetRot = rotY[this.lastDirection] || 0;
        this.player.rotation.y = THREE.MathUtils.lerp(this.player.rotation.y, targetRot, 0.15);

        if (moving) {
            const animName = this.keys['shift'] ? 'run' : 'walk';
            this.switchAnimation(animName);
            this.isMoving = true;
        } else {
            this.switchAnimation('idle');
            this.isMoving = false;
        }

        const camTargetX = this.player.position.x;
        const camTargetZ = this.player.position.z + 12;
        this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, camTargetX, 0.05);
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, camTargetZ, 0.05);
        this.camera.lookAt(
            this.player.position.x,
            1,
            this.player.position.z
        );

        this.sun.position.x = this.player.position.x + 20;
        this.sun.position.z = this.player.position.z + 10;
        this.sun.target.position.copy(this.player.position);
        this.sun.target.updateMatrixWorld();

        if (this.isMoving && this.encounterCooldown <= 0) {
            if (Math.random() < 0.012) {
                this.encounterCooldown = 2;
                if (this.game.state === 'overworld') {
                    this.game.startWildBattle();
                }
            }
        }

        if (this.encounterCooldown > 0) {
            this.encounterCooldown -= delta;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.game.state === 'overworld' && this.ready) {
            this.update();
            this.renderer.render(this.scene, this.camera);
        }
    }

    show() {
        const canvas = this.renderer.domElement;
        canvas.style.display = 'block';
        const gameCanvas = document.getElementById('game-canvas');
        if (gameCanvas) gameCanvas.style.display = 'none';
        this.clock.start();
    }

    hide() {
        const canvas = this.renderer.domElement;
        canvas.style.display = 'none';
        const gameCanvas = document.getElementById('game-canvas');
        if (gameCanvas) gameCanvas.style.display = 'block';
    }

    resetPosition() {
        if (this.player) {
            this.player.position.set(0, 0, 0);
        }
    }
}
