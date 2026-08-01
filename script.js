// =====================================================================
// ROCKET BLASTER — pilot a color-customizable rocket through an
// asteroid field. Dodge or blast the rocks — one crash and it's over.
// =====================================================================

var Colors = {
	darkMetal: 0x3a3f4b,
	glass: 0x8fd8ff,
	flame: 0xffa23c,
	flameCore: 0xfff2b0,
	asteroid1: 0x8a7f76,
	asteroid2: 0x6f6259,
	asteroid3: 0x9c8d7c,
	laser: 0x7CFC00
};

var shipColors = [
	{ name: 'Coral',   hex: 0xf25346 },
	{ name: 'Cyan',    hex: 0x4fd8e0 },
	{ name: 'Violet',  hex: 0x9b5de5 },
	{ name: 'Gold',    hex: 0xffd23f },
	{ name: 'Emerald', hex: 0x06d6a0 }
];

var scene, camera, fieldOfView, aspectRatio, nearPlane, farPlane, HEIGHT, WIDTH, renderer, container;
var clock;

function createScene() {
	HEIGHT = window.innerHeight;
	WIDTH = window.innerWidth;

	scene = new THREE.Scene();
	scene.fog = new THREE.Fog(0x0a0e24, 300, 2400);

	aspectRatio = WIDTH / HEIGHT;
	fieldOfView = 65;
	nearPlane = 1;
	farPlane = 5000;
	camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);
	camera.position.set(120, 90, 260);

	renderer = new THREE.WebGLRenderer({
		alpha: true,
		antialias: true
	});
	renderer.setSize(WIDTH, HEIGHT);
	renderer.shadowMapEnabled = true;

	container = document.getElementById('world');
	container.appendChild(renderer.domElement);

	window.addEventListener('resize', handleWindowResize, false);
}

function handleWindowResize() {
	HEIGHT = window.innerHeight;
	WIDTH = window.innerWidth;
	renderer.setSize(WIDTH, HEIGHT);
	camera.aspect = WIDTH / HEIGHT;
	camera.updateProjectionMatrix();
}

var hemisphereLight, shadowLight;

function createLights() {
	hemisphereLight = new THREE.HemisphereLight(0x8899ff, 0x000011, .85);
	shadowLight = new THREE.DirectionalLight(0xffffff, .7);
	shadowLight.position.set(100, 300, 300);
	shadowLight.castShadow = true;

	shadowLight.shadowCameraLeft = -400;
	shadowLight.shadowCameraRight = 400;
	shadowLight.shadowCameraTop = 400;
	shadowLight.shadowCameraBottom = -400;
	shadowLight.shadowCameraNear = 1;
	shadowLight.shadowCameraFar = 1000;

	shadowLight.shadowMapWidth = 2048;
	shadowLight.shadowMapHeight = 2048;

	scene.add(hemisphereLight);
	scene.add(shadowLight);
}

// ---------------------------------------------------------------------
// Starfield + distant nebula / planets
// ---------------------------------------------------------------------
var stars;

function createStars() {
	var geometry = new THREE.Geometry();
	for (var i = 0; i < 1200; i++) {
		var star = new THREE.Vector3(
			Math.random() * 4000 - 2000,
			Math.random() * 2000 - 400,
			Math.random() * 2600 - 2400
		);
		geometry.vertices.push(star);
	}

	var StarMaterial = THREE.PointsMaterial || THREE.ParticleBasicMaterial || THREE.PointCloudMaterial;
	var material = new StarMaterial({
		color: 0xffffff,
		size: 3.4,
		transparent: true,
		opacity: 0.95,
		sizeAttenuation: true,
		fog: false,
		depthWrite: false
	});

	var StarSystem = THREE.Points || THREE.PointCloud || THREE.ParticleSystem;
	stars = new StarSystem(geometry, material);
	scene.add(stars);
}

var nebulaGroup, planets = [];

function createNebula() {
	nebulaGroup = new THREE.Object3D();
	var nebulaColors = [0x6f3ad9, 0xd94aa0, 0x2ad9c2];
	for (var i = 0; i < nebulaColors.length; i++) {
		var cloud = new THREE.Mesh(
			new THREE.SphereGeometry(500 + i * 120, 10, 8),
			new THREE.MeshBasicMaterial({ color: nebulaColors[i], transparent: true, opacity: 0.07, side: THREE.BackSide })
		);
		cloud.position.set((i - 1) * 300, 200 + i * 60, -1900 - i * 150);
		nebulaGroup.add(cloud);
	}
	scene.add(nebulaGroup);

	var planetData = [
		{ radius: 90, color: 0xd97b4a, pos: [-650, 260, -2100] },
		{ radius: 55, color: 0x6f9be0, pos: [700, 140, -1850] }
	];
	for (var p = 0; p < planetData.length; p++) {
		var pd = planetData[p];
		var planet = new THREE.Mesh(
			new THREE.SphereGeometry(pd.radius, 14, 12),
			new THREE.MeshPhongMaterial({ color: pd.color, shading: THREE.FlatShading })
		);
		planet.position.set(pd.pos[0], pd.pos[1], pd.pos[2]);
		scene.add(planet);
		planets.push(planet);
	}
}

// ---------------------------------------------------------------------
// Rocket ship
// ---------------------------------------------------------------------
var RocketShip = function () {
	this.mesh = new THREE.Object3D();
	this.matHull = new THREE.MeshPhongMaterial({ color: shipColors[0].hex, shading: THREE.FlatShading });

	// Main body
	var geomBody = new THREE.CylinderGeometry(16, 20, 110, 8, 1);
	geomBody.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
	var body = new THREE.Mesh(geomBody, this.matHull);
	body.position.set(0, 0, 0);
	body.castShadow = true;
	body.receiveShadow = true;
	this.mesh.add(body);

	// Nose cone
	var geomNose = new THREE.CylinderGeometry(0, 16, 45, 8, 1, false);
	geomNose.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
	var nose = new THREE.Mesh(geomNose, this.matHull);
	nose.position.set(0, 0, 70);
	nose.castShadow = true;
	nose.receiveShadow = true;
	this.mesh.add(nose);

	// Tail fin
	var geomTail = new THREE.BoxGeometry(16, 20, 6);
	var tailFin = new THREE.Mesh(geomTail, this.matHull);
	tailFin.position.set(0, 0, -45);
	tailFin.castShadow = true;
	this.mesh.add(tailFin);

	// Side fins (delta wings)
	var geomFin = new THREE.BoxGeometry(30, 4, 40, 1, 1, 1);
	var finTop = new THREE.Mesh(geomFin, this.matHull);
	var finBottom = new THREE.Mesh(geomFin, this.matHull);
	finTop.position.set(0, 12, -12);
	finBottom.position.set(0, -12, -12);
	finTop.castShadow = true;
	finBottom.castShadow = true;
	this.mesh.add(finTop);
	this.mesh.add(finBottom);

	// Cockpit canopy
	var geomCanopy = new THREE.SphereGeometry(15, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.8);
	var matCanopy = new THREE.MeshPhongMaterial({ color: Colors.glass, transparent: true, opacity: .55, shading: THREE.FlatShading });
	var canopy = new THREE.Mesh(geomCanopy, matCanopy);
	canopy.position.set(0, 12, 28);
	canopy.castShadow = true;
	this.mesh.add(canopy);

	// Blaster cannons mounted on the wingtips
	var matCannon = new THREE.MeshPhongMaterial({ color: Colors.darkMetal, shading: THREE.FlatShading });
	var geomCannon = new THREE.CylinderGeometry(3.4, 3.4, 40, 8);
	geomCannon.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));

	this.cannonL = new THREE.Mesh(geomCannon, matCannon);
	this.cannonL.position.set(-18, 0, 24);
	this.cannonL.castShadow = true;
	this.mesh.add(this.cannonL);

	this.cannonR = this.cannonL.clone();
	this.cannonR.position.x = 18;
	this.mesh.add(this.cannonR);

	var matTip = new THREE.MeshBasicMaterial({ color: Colors.laser });
	var geomTip = new THREE.SphereGeometry(3.8, 6, 6);
	var tipL = new THREE.Mesh(geomTip, matTip);
	tipL.position.set(0, 0, 20);
	this.cannonL.add(tipL);
	var tipR = new THREE.Mesh(geomTip, matTip);
	tipR.position.set(0, 0, 20);
	this.cannonR.add(tipR);

	// Engine flame
	this.flameCore = new THREE.Mesh(
		new THREE.CylinderGeometry(0, 9, 30, 8, 1, false),
		new THREE.MeshBasicMaterial({ color: Colors.flameCore, transparent: true, opacity: .9 })
	);
	this.flameCore.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
	this.flameCore.position.set(0, 0, -60);
	this.mesh.add(this.flameCore);

	this.flameOuter = new THREE.Mesh(
		new THREE.CylinderGeometry(0, 15, 50, 8, 1, false),
		new THREE.MeshBasicMaterial({ color: Colors.flame, transparent: true, opacity: .5 })
	);
	this.flameOuter.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
	this.flameOuter.position.set(0, 0, -68);
	this.mesh.add(this.flameOuter);
};

RocketShip.prototype.recolor = function (hex) {
	this.matHull.color.setHex(hex);
};

RocketShip.prototype.cannonWorldPos = function (which) {
	var cannon = which === 'L' ? this.cannonL : this.cannonR;
	var v = new THREE.Vector3(20, 0, 0);
	cannon.localToWorld(v);
	return v;
};

var ship;

function createShip() {
	ship = new RocketShip();
	ship.mesh.scale.set(.62, .62, .62);
	ship.mesh.position.set(0, 130, 0);
	ship.mesh.rotation.set(0, Math.PI, 0);
	scene.add(ship.mesh);
}

// ---------------------------------------------------------------------
// Asteroids
// ---------------------------------------------------------------------
var ASTEROID_COUNT = 16;
var asteroids = [];
var PLAY_X = 190, PLAY_Y_MIN = 30, PLAY_Y_MAX = 240;
var SPAWN_Z = -2200;
var DESPAWN_Z = 260;

function makeAsteroidMesh(radius) {
	var geom = new THREE.IcosahedronGeometry(radius, 0);
	for (var i = 0; i < geom.vertices.length; i++) {
		var jitter = 0.75 + Math.random() * 0.5;
		geom.vertices[i].multiplyScalar(jitter);
	}
	geom.computeFaceNormals();
	geom.computeVertexNormals();

	var palette = [Colors.asteroid1, Colors.asteroid2, Colors.asteroid3];
	var mat = new THREE.MeshPhongMaterial({ color: palette[Math.floor(Math.random() * palette.length)], shading: THREE.FlatShading });
	var mesh = new THREE.Mesh(geom, mat);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

function currentAsteroidSpeed() {
	return 6 + Math.min(10, elapsedTime * 0.08);
}

function spawnAsteroid(a, initialSpread) {
	var radius = 14 + Math.random() * 30;
	if (a.mesh) {
		scene.remove(a.mesh);
	}
	a.mesh = makeAsteroidMesh(radius);
	a.radius = radius;
	a.mesh.position.set(
		(Math.random() * 2 - 1) * PLAY_X,
		PLAY_Y_MIN + Math.random() * (PLAY_Y_MAX - PLAY_Y_MIN),
		initialSpread ? SPAWN_Z - Math.random() * 1600 : SPAWN_Z - Math.random() * 300
	);
	a.spin = { x: (Math.random() - .5) * .03, y: (Math.random() - .5) * .03, z: (Math.random() - .5) * .03 };
	a.speed = currentAsteroidSpeed() + Math.random() * 2;
	var s = 0.7 + Math.random() * 0.5;
	a.mesh.scale.set(s, s, s);
	scene.add(a.mesh);
}

function createAsteroidField() {
	for (var i = 0; i < ASTEROID_COUNT; i++) {
		var a = {};
		spawnAsteroid(a, true);
		asteroids.push(a);
	}
}

// ---------------------------------------------------------------------
// Lasers / blaster bolts
// ---------------------------------------------------------------------
var lasers = [];
var LASER_SPEED = 26;
var fireCooldown = 0;
var altFireCooldown = 0;
var nextCannon = 'L';
var fireMode = 'single';

function fireBlaster(primary) {
	if (gameState !== 'playing') return;
	if (primary && fireCooldown > 0) return;
	if (!primary && altFireCooldown > 0) return;
	if (primary) fireCooldown = 0.12; else altFireCooldown = 0.22;
	var origin = ship.cannonWorldPos(nextCannon);
	nextCannon = nextCannon === 'L' ? 'R' : 'L';

	var geom = new THREE.CylinderGeometry(2, 2, 26, 6);
	geom.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
	var mat = new THREE.MeshBasicMaterial({ color: Colors.laser });
	var bolt = new THREE.Mesh(geom, mat);
	bolt.position.copy(origin);
	if (!primary) bolt.scale.set(1.3, 1.3, 1.5);
	scene.add(bolt);
	lasers.push(bolt);
}

function updateLasers() {
	for (var i = lasers.length - 1; i >= 0; i--) {
		var bolt = lasers[i];
		bolt.position.z -= LASER_SPEED;

		if (bolt.position.z < SPAWN_Z + 200) {
			scene.remove(bolt);
			lasers.splice(i, 1);
			continue;
		}

		var hit = false;
		for (var j = 0; j < asteroids.length; j++) {
			var a = asteroids[j];
			var dx = a.mesh.position.x - bolt.position.x;
			var dy = a.mesh.position.y - bolt.position.y;
			var dz = a.mesh.position.z - bolt.position.z;
			var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (dist < a.radius * a.mesh.scale.x + 8) {
				spawnExplosion(a.mesh.position, 0xffcc66, 1.4);
				spawnAsteroid(a, false);
				score += 40;
				hit = true;
				break;
			}
		}
		if (hit) {
			scene.remove(bolt);
			lasers.splice(i, 1);
		}
	}
}

// ---------------------------------------------------------------------
// Explosions
// ---------------------------------------------------------------------
var explosions = [];

function spawnExplosion(position, color, scale) {
	var group = new THREE.Object3D();
	var n = 10;
	for (var i = 0; i < n; i++) {
		var mat = new THREE.MeshBasicMaterial({ color: color || 0xffb347, transparent: true, opacity: 1 });
		var chunk = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), mat);
		chunk.userData.vel = {
			x: (Math.random() - .5) * (scale || 1) * 6,
			y: (Math.random() - .5) * (scale || 1) * 6,
			z: (Math.random() - .5) * (scale || 1) * 6
		};
		group.add(chunk);
	}
	group.position.copy(position);
	group.userData.life = 0;
	scene.add(group);
	explosions.push(group);
}

function updateExplosions(dt) {
	for (var i = explosions.length - 1; i >= 0; i--) {
		var g = explosions[i];
		g.userData.life += dt;
		for (var j = 0; j < g.children.length; j++) {
			var c = g.children[j];
			c.position.x += c.userData.vel.x * dt * 10;
			c.position.y += c.userData.vel.y * dt * 10;
			c.position.z += c.userData.vel.z * dt * 10;
			c.material.opacity = Math.max(0, 1 - g.userData.life * 1.2);
		}
		if (g.userData.life > 0.9) {
			scene.remove(g);
			explosions.splice(i, 1);
		}
	}
}

// ---------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------
var gameState = 'playing';
var score = 0;
var bestScore = 0;
var elapsedTime = 0;
var level = 1;
var lives = 3;
var boostMeter = 100;
var boostActive = false;
var boostCooldown = 0;
var alertTimer = 0;
var alertMessage = '';
var waveTimer = 0;
var asteroidSpawnCooldown = 0;
var nextWaveAt = 3;

var mousePos = { x: 0, y: 0 };
var touchPos = { x: 0, y: 0 };
var keyboardSteer = { x: 0, y: 0 };
var joystickActive = false;
var joystickBase = null;
var joystickHandle = null;
var joystickCenter = { x: 0, y: 0 };
var joystickBounds = null;
var spaceHeld = false;

var cameraMode = 'follow';
var cameraViewIndex = 0;
var cameraViews = ['follow', 'chase'];

function loadBestScore() {
	try {
		var v = localStorage.getItem('rocketBlasterBest');
		bestScore = v ? parseInt(v, 10) : 0;
	} catch (e) {
		bestScore = 0;
	}
}

function saveBestScore() {
	try {
		localStorage.setItem('rocketBlasterBest', String(Math.floor(bestScore)));
	} catch (e) {
		// storage unavailable — ignore
	}
}

function updateHud() {
	var scoreEl = document.getElementById('score');
	var bestEl = document.getElementById('best-score');
	var levelEl = document.getElementById('level-number');
	var boostEl = document.getElementById('boost-value');
	if (scoreEl) scoreEl.textContent = Math.floor(score);
	if (bestEl) bestEl.textContent = Math.floor(bestScore);
	if (levelEl) levelEl.textContent = level;
	if (boostEl) boostEl.textContent = Math.max(0, Math.floor(boostMeter));
	var hud = document.getElementById('hud');
	if (hud && !document.getElementById('lives-line')) {
		var livesLine = document.createElement('div');
		livesLine.id = 'lives-line';
		livesLine.textContent = 'Lives: ' + lives;
		hud.appendChild(livesLine);
	} else if (document.getElementById('lives-line')) {
		document.getElementById('lives-line').textContent = 'Lives: ' + lives;
	}
}

function triggerGameOver() {
	if (gameState !== 'playing') return;
	lives -= 1;
	spawnExplosion(ship.mesh.position, 0xff5533, 2.2);
	ship.mesh.visible = false;
	updateHud();
	if (lives > 0) {
		setTimeout(function () {
			if (gameState === 'playing') {
				ship.mesh.visible = true;
				ship.mesh.position.set(0, 130, 0);
				ship.mesh.rotation.set(0, Math.PI, 0);
			}
		}, 800);
		return;
	}
	gameState = 'gameover';
	if (score > bestScore) {
		bestScore = score;
		saveBestScore();
	}
	var overlay = document.getElementById('game-over');
	var finalScoreEl = document.getElementById('final-score');
	if (finalScoreEl) finalScoreEl.textContent = Math.floor(score);
	if (overlay) overlay.classList.add('visible');
}

function restartGame() {
	gameState = 'playing';
	score = 0;
	elapsedTime = 0;
	level = 1;
	lives = 3;
	boostMeter = 100;
	boostActive = false;
	boostCooldown = 0;
	alertTimer = 0;
	alertMessage = '';
	waveTimer = 0;
	asteroidSpawnCooldown = 0;
	nextWaveAt = 3;
	ship.mesh.visible = true;
	ship.mesh.position.set(0, 130, 0);
	ship.mesh.rotation.set(0, Math.PI, 0);

	for (var i = 0; i < asteroids.length; i++) {
		spawnAsteroid(asteroids[i], true);
	}
	for (var l = lasers.length - 1; l >= 0; l--) {
		scene.remove(lasers[l]);
	}
	lasers = [];
	for (var e = explosions.length - 1; e >= 0; e--) {
		scene.remove(explosions[e]);
	}
	explosions = [];

	var overlay = document.getElementById('game-over');
	if (overlay) overlay.classList.remove('visible');
	updateHud();
}

function normalize(v, vmin, vmax, tmin, tmax) {
	var nv = Math.max(Math.min(v, vmax), vmin);
	var dv = vmax - vmin;
	var pc = (nv - vmin) / dv;
	var dt = tmax - tmin;
	return tmin + pc * dt;
}

function updateShip() {
	var controlX = mousePos.x;
	var controlY = mousePos.y;

	if (joystickActive) {
		controlX = touchPos.x;
		controlY = touchPos.y;
	}
	if (Math.abs(keyboardSteer.x) > 0.01 || Math.abs(keyboardSteer.y) > 0.01) {
		controlX = keyboardSteer.x;
		controlY = keyboardSteer.y;
	}

	var targetY = normalize(controlY, -.75, .75, PLAY_Y_MIN + 10, PLAY_Y_MAX - 10);
	var targetX = normalize(controlX, -.75, .75, -PLAY_X + 30, PLAY_X - 30);
	var forwardBoost = boostActive ? 1.8 : 1;

	ship.mesh.position.y += (targetY - ship.mesh.position.y) * 0.12;
	ship.mesh.position.x += (targetX - ship.mesh.position.x) * 0.12;
	ship.mesh.position.z -= 0.8 * forwardBoost;

	ship.mesh.rotation.z = (targetX - ship.mesh.position.x) * -0.025;
	ship.mesh.rotation.x = (ship.mesh.position.y - targetY) * 0.01;
	ship.mesh.rotation.y = Math.PI + (targetX - ship.mesh.position.x) * 0.01;

	var pulse = 1 + Math.sin(elapsedTime * 20) * 0.15 + (boostActive ? 0.2 : 0);
	ship.flameCore.scale.set(pulse, 1, pulse);
	ship.flameOuter.scale.set(pulse * .9, 1, pulse * .9);
}

function showAlert(message) {
	var alertBox = document.getElementById('alert-box');
	if (!alertBox) return;
	alertBox.textContent = message;
	alertBox.classList.add('visible');
	alertTimer = 1.2;
	alertMessage = message;
}

function updateAsteroids() {
	if (asteroidSpawnCooldown > 0) asteroidSpawnCooldown -= 0.016;
	waveTimer += 0.016;
	if (waveTimer > nextWaveAt) {
		waveTimer = 0;
		nextWaveAt = Math.max(2.2, 4 - level * 0.3);
		showAlert('Wave incoming!');
		for (var s = 0; s < Math.min(10 + level * 2, 24); s++) {
			var extra = {};
			spawnAsteroid(extra, true);
			asteroids.push(extra);
		}
	}

	for (var i = 0; i < asteroids.length; i++) {
		var a = asteroids[i];
		a.mesh.position.z += a.speed + (boostActive ? 1.2 : 0);
		a.mesh.rotation.x += a.spin.x;
		a.mesh.rotation.y += a.spin.y;
		a.mesh.rotation.z += a.spin.z;

		if (a.mesh.position.z > DESPAWN_Z) {
			if (gameState === 'playing') {
				score += 15;
			}
			spawnAsteroid(a, false);
			continue;
		}

		if (gameState === 'playing') {
			var dx = a.mesh.position.x - ship.mesh.position.x;
			var dy = a.mesh.position.y - ship.mesh.position.y;
			var dz = a.mesh.position.z - ship.mesh.position.z;
			var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (dist < a.radius * a.mesh.scale.x + 24) {
				triggerGameOver();
			}
		}
	}
}

function toggleCameraView() {
	cameraViewIndex = (cameraViewIndex + 1) % cameraViews.length;
	cameraMode = cameraViews[cameraViewIndex];
	var cycleButton = document.getElementById('view-cycle');
	if (cycleButton) {
		cycleButton.textContent = 'View: ' + (cameraMode === 'follow' ? 'Follow' : 'Chase');
	}
}

function updateCamera() {
	if (!ship || !camera) return;
	var p = ship.mesh.position;
	if (cameraMode === 'chase') {
		camera.position.x = p.x * 0.2;
		camera.position.y = p.y + 30;
		camera.position.z = p.z + 140;
	} else {
		camera.position.x = p.x * 0.15;
		camera.position.y = p.y + 38;
		camera.position.z = p.z + 180;
	}
	camera.lookAt(new THREE.Vector3(p.x, p.y, p.z - 260));
}

function loop() {
	var dt = clock.getDelta();
	if (dt > 0.1) dt = 0.1;

	if (gameState === 'playing') {
		elapsedTime += dt;
		score += dt * 6;
		level = 1 + Math.floor(score / 1200);
		if (fireCooldown > 0) fireCooldown -= dt;
		if (altFireCooldown > 0) altFireCooldown -= dt;
		if (boostCooldown > 0) boostCooldown -= dt;
		if (alertTimer > 0) {
			alertTimer -= dt;
			if (alertTimer <= 0) {
				var alertBox = document.getElementById('alert-box');
				if (alertBox) alertBox.classList.remove('visible');
			}
		}
		if (boostActive) {
			boostMeter = Math.max(0, boostMeter - dt * 16);
			if (boostMeter <= 0) boostActive = false;
		} else if (boostMeter < 100) {
			boostMeter = Math.min(100, boostMeter + dt * 8);
		}
		handleJoystickInput();
		if (spaceHeld) fireBlaster(true);
		if (fireMode === 'dual' && spaceHeld) fireBlaster(false);

		updateShip();
		updateAsteroids();
		updateLasers();
	}
	updateExplosions(dt);
	updateCamera();

	if (stars) stars.rotation.y += 0.0003;

	updateHud();
	renderer.render(scene, camera);
	requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------
function handleMouseMove(event) {
	var tx = -1 + (event.clientX / WIDTH) * 2;
	var ty = 1 - (event.clientY / HEIGHT) * 2;
	mousePos = { x: tx, y: ty };
}

function setTouchInput(x, y) {
	var tx = -1 + (x / WIDTH) * 2;
	var ty = 1 - (y / HEIGHT) * 2;
	touchPos = { x: tx, y: ty };
}

function handleJoystickInput() {
	var x = 0;
	var y = 0;
	if (joystickActive) {
		x = touchPos.x;
		y = touchPos.y;
	} else if (Math.abs(keyboardSteer.x) > 0.01 || Math.abs(keyboardSteer.y) > 0.01) {
		x = keyboardSteer.x;
		y = keyboardSteer.y;
	}
	x = Math.max(-1, Math.min(1, x));
	y = Math.max(-1, Math.min(1, y));
	mousePos = { x: x, y: y };
	if (joystickHandle) {
		var px = x * 26;
		var py = -y * 26;
		joystickHandle.style.transform = 'translate(' + px + 'px, ' + py + 'px)';
	}
}

function handleTouchStart(event) {
	if (event.touches.length === 0) return;
	var touch = event.touches[0];
	if (!joystickBase) return;
	var rect = joystickBase.getBoundingClientRect();
	var inside = touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
	if (!inside) return;
	joystickActive = true;
	joystickCenter = { x: touch.clientX, y: touch.clientY };
	setTouchInput(touch.clientX, touch.clientY);
}

function handleTouchMove(event) {
	if (!joystickActive || event.touches.length === 0) return;
	var touch = event.touches[0];
	var dx = touch.clientX - joystickCenter.x;
	var dy = touch.clientY - joystickCenter.y;
	var maxDistance = 38;
	var dist = Math.min(maxDistance, Math.sqrt(dx * dx + dy * dy));
	var angle = Math.atan2(dy, dx);
	var clampedX = Math.cos(angle) * dist;
	var clampedY = Math.sin(angle) * dist;
	var tx = joystickCenter.x + clampedX;
	var ty = joystickCenter.y + clampedY;
	setTouchInput(clampedX / 38, clampedY / 38);
	event.preventDefault();
}

function handleTouchEnd() {
	joystickActive = false;
	setTouchInput(joystickCenter.x, joystickCenter.y);
	if (joystickHandle) {
		joystickHandle.style.transform = 'translate(0px, 0px)';
	}
}

function handleKeyDown(event) {
	var key = event.key.toLowerCase();
	if (key === 'arrowleft' || key === 'a') {
		keyboardSteer.x = -1;
	} else if (key === 'arrowright' || key === 'd') {
		keyboardSteer.x = 1;
	} else if (key === 'arrowup' || key === 'w') {
		keyboardSteer.y = 1;
	} else if (key === 'arrowdown' || key === 's') {
		keyboardSteer.y = -1;
	} else if (key === 'v') {
		toggleCameraView();
	} else if (key === 'b') {
		if (!boostActive && boostCooldown <= 0 && boostMeter > 0) {
			boostActive = true;
			boostCooldown = 2.4;
		}
	} else if (key === 'f') {
		fireMode = fireMode === 'single' ? 'dual' : 'single';
		showAlert(fireMode === 'dual' ? 'Dual fire online!' : 'Single fire mode');
	} else if (key === ' ') {
		if (gameState === 'gameover') {
			restartGame();
		} else {
			spaceHeld = true;
		}
	} else if (key === 'r') {
		if (gameState === 'gameover') restartGame();
	}
	if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "s", "d", "w", "v", "b", "f", " "].indexOf(key) !== -1) {
		event.preventDefault();
	}
}

function handleKeyUp(event) {
	var key = event.key.toLowerCase();
	if (key === 'arrowleft' || key === 'a') {
		keyboardSteer.x = 0;
	} else if (key === 'arrowright' || key === 'd') {
		keyboardSteer.x = 0;
	} else if (key === 'arrowup' || key === 'w') {
		keyboardSteer.y = 0;
	} else if (key === 'arrowdown' || key === 's') {
		keyboardSteer.y = 0;
	} else if (key === ' ') {
		spaceHeld = false;
	}
}

function init() {
	clock = new THREE.Clock();
	loadBestScore();

	createScene();
	createLights();
	createShip();
	createStars();
	createNebula();
	createAsteroidField();

	document.addEventListener('mousemove', handleMouseMove, false);
	document.addEventListener('touchstart', handleTouchStart, { passive: false });
	document.addEventListener('touchmove', handleTouchMove, { passive: false });
	document.addEventListener('touchend', handleTouchEnd, false);
	document.addEventListener('keydown', handleKeyDown, false);
	document.addEventListener('keyup', handleKeyUp, false);

	joystickBase = document.getElementById('joystick');
	joystickHandle = document.getElementById('joystick-handle');

	var colorButtons = document.querySelectorAll('.color-btn');
	for (var i = 0; i < colorButtons.length; i++) {
		colorButtons[i].addEventListener('click', function () {
			var hex = parseInt(this.getAttribute('data-color'), 16);
			ship.recolor(hex);
			for (var b = 0; b < colorButtons.length; b++) {
				colorButtons[b].classList.remove('active');
			}
			this.classList.add('active');
		});
	}

	var viewButton = document.getElementById('view-cycle');
	if (viewButton) viewButton.addEventListener('click', toggleCameraView);

	var fireBtn = document.getElementById('fire-btn');
	if (fireBtn) {
		fireBtn.addEventListener('mousedown', function (e) { e.preventDefault(); spaceHeld = true; });
		fireBtn.addEventListener('mouseup', function () { spaceHeld = false; });
		fireBtn.addEventListener('mouseleave', function () { spaceHeld = false; });
		fireBtn.addEventListener('touchstart', function (e) { e.preventDefault(); spaceHeld = true; }, { passive: false });
		fireBtn.addEventListener('touchend', function (e) { e.preventDefault(); spaceHeld = false; }, { passive: false });
	}

	var altFireBtn = document.getElementById('alt-fire-btn');
	if (altFireBtn) {
		altFireBtn.addEventListener('mousedown', function (e) { e.preventDefault(); fireMode = fireMode === 'single' ? 'dual' : 'single'; showAlert(fireMode === 'dual' ? 'Dual fire online!' : 'Single fire mode'); });
		altFireBtn.addEventListener('touchstart', function (e) { e.preventDefault(); fireMode = fireMode === 'single' ? 'dual' : 'single'; showAlert(fireMode === 'dual' ? 'Dual fire online!' : 'Single fire mode'); }, { passive: false });
	}

	var boostBtn = document.getElementById('boost-btn');
	if (boostBtn) {
		boostBtn.addEventListener('mousedown', function (e) { e.preventDefault(); if (!boostActive && boostCooldown <= 0 && boostMeter > 0) { boostActive = true; boostCooldown = 2.4; } });
		boostBtn.addEventListener('touchstart', function (e) { e.preventDefault(); if (!boostActive && boostCooldown <= 0 && boostMeter > 0) { boostActive = true; boostCooldown = 2.4; } }, { passive: false });
	}

	var restartBtn = document.getElementById('restart-btn');
	if (restartBtn) restartBtn.addEventListener('click', restartGame);

	updateHud();
	loop();
}

window.addEventListener('load', init, false);
