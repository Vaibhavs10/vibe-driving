import * as THREE from 'three';

export class Terrain {
    constructor(scene) {
        this.scene = scene;
        this.groundSize = 2000;
        this.groundSegments = 200;
        this.terrainMesh = null;
        this.heightData = null;
        this.decorationChunks = new Map();
        this.chunkSize = 100; // Size of each decoration chunk
        this.visibleRange = 450; // Increased visible range from 350 to 450
    }
    
    build() {
        // Create the ground geometry
        const groundGeometry = new THREE.PlaneGeometry(
            this.groundSize, 
            this.groundSize, 
            this.groundSegments, 
            this.groundSegments
        );
        
        // Apply height variation
        this.applyHeightVariation(groundGeometry);
        
        // Create ground material
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xE6D5AC, // Warm sand/soil color
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        // Create the ground mesh
        this.terrainMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.terrainMesh.rotation.x = -Math.PI / 2;
        this.terrainMesh.receiveShadow = true;
        this.scene.add(this.terrainMesh);
        
        return this.terrainMesh;
    }
    
    applyHeightVariation(groundGeometry) {
        const vertices = groundGeometry.attributes.position.array;
        const width = this.groundSegments + 1;
        const height = this.groundSegments + 1;
        
        // Create height data array
        this.heightData = new Float32Array(width * height);
        
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 1]; // Note: y is up in geometry, z in world
            
            // Simplified noise function - mix of different frequencies
            const nx = x / this.groundSize * 2;
            const nz = z / this.groundSize * 2;
            
            // Simplifed multi-octave noise
            let height = 0;
            height += this.simplifiedNoise(nx * 1.5, nz * 1.5) * 7;
            height += this.simplifiedNoise(nx * 5, nz * 5) * 2;
            height += this.simplifiedNoise(nx * 15, nz * 15) * 0.5;
            
            // Flatten center area for gameplay
            const distanceFromCenter = Math.sqrt(x * x + z * z);
            const flattenFactor = 1 - Math.max(0, 1 - distanceFromCenter / 30);
            height *= flattenFactor;
            
            vertices[i + 2] = height; // Apply height to geometry
            
            // Store in height data array
            const ix = Math.floor((x + this.groundSize / 2) / this.groundSize * width);
            const iz = Math.floor((z + this.groundSize / 2) / this.groundSize * height);
            if (ix >= 0 && ix < width && iz >= 0 && iz < height) {
                this.heightData[iz * width + ix] = height;
            }
        }
        
        // Update normals for lighting
        groundGeometry.computeVertexNormals();
    }
    
    simplifiedNoise(x, y) {
        // Simple noise function approximation
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        
        // Simple smoothing
        const u = this.fade(xf);
        const v = this.fade(yf);
        
        // Simple hash
        const A = (X + Y * 57) & 255;
        const B = (X + 1 + Y * 57) & 255;
        const C = (X + (Y + 1) * 57) & 255;
        const D = (X + 1 + (Y + 1) * 57) & 255;
        
        // Simple gradient
        const res = this.lerp(
            this.lerp(this.grad(A, xf, yf), this.grad(B, xf - 1, yf), u),
            this.lerp(this.grad(C, xf, yf - 1), this.grad(D, xf - 1, yf - 1), u),
            v
        );
        
        return res;
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y) {
        const h = hash & 15;
        const grad2 = 1 + (h & 7);
        return ((h & 8) ? -grad2 : grad2) * x + ((h & 4) ? -grad2 : grad2) * y;
    }
    
    getHeightAt(x, z) {
        if (!this.heightData) return 0;
        
        // Convert world coordinates to heightmap coordinates
        const width = this.groundSegments + 1;
        const height = this.groundSegments + 1;
        
        const ix = Math.floor((x + this.groundSize / 2) / this.groundSize * width);
        const iz = Math.floor((z + this.groundSize / 2) / this.groundSize * height);
        
        // Boundary check
        if (ix < 0 || ix >= width - 1 || iz < 0 || iz >= height - 1) {
            return 0;
        }
        
        // Get the four nearest height values
        const h00 = this.heightData[iz * width + ix];
        const h10 = this.heightData[iz * width + (ix + 1)];
        const h01 = this.heightData[(iz + 1) * width + ix];
        const h11 = this.heightData[(iz + 1) * width + (ix + 1)];
        
        // Determine fractional position
        const percentX = (x + this.groundSize / 2) / this.groundSize * width - ix;
        const percentZ = (z + this.groundSize / 2) / this.groundSize * height - iz;
        
        // Bilinear interpolation
        const h0 = h00 * (1 - percentX) + h10 * percentX;
        const h1 = h01 * (1 - percentX) + h11 * percentX;
        const finalHeight = h0 * (1 - percentZ) + h1 * percentZ;
        
        return finalHeight;
    }
    
    getRoughnessAt(x, z) {
        // Calculate roughness based on nearby height samples
        const spacing = 2;
        const h1 = this.getHeightAt(x - spacing, z - spacing);
        const h2 = this.getHeightAt(x + spacing, z - spacing);
        const h3 = this.getHeightAt(x - spacing, z + spacing);
        const h4 = this.getHeightAt(x + spacing, z + spacing);
        
        // Measure variation
        const maxH = Math.max(h1, h2, h3, h4);
        const minH = Math.min(h1, h2, h3, h4);
        return maxH - minH;
    }
    
    updateDecorations(truckPosition) {
        // Get the current chunk the truck is in
        const chunkX = Math.floor(truckPosition.x / this.chunkSize);
        const chunkZ = Math.floor(truckPosition.z / this.chunkSize);
        
        // Range of chunks to keep loaded
        const range = Math.ceil(this.visibleRange / this.chunkSize);
        
        // Remove chunks that are too far away
        for (const key of this.decorationChunks.keys()) {
            const [x, z] = key.split(',').map(Number);
            if (Math.abs(x - chunkX) > range || Math.abs(z - chunkZ) > range) {
                const chunk = this.decorationChunks.get(key);
                if (chunk) {
                    chunk.forEach(obj => this.scene.remove(obj));
                }
                this.decorationChunks.delete(key);
            }
        }
        
        // Create new chunks in range
        for (let x = chunkX - range; x <= chunkX + range; x++) {
            for (let z = chunkZ - range; z <= chunkZ + range; z++) {
                const key = `${x},${z}`;
                if (!this.decorationChunks.has(key)) {
                    this.createDecorationChunk(x, z);
                }
            }
        }
    }
    
    createDecorationChunk(chunkX, chunkZ) {
        const chunkObjects = [];
        const chunkKey = `${chunkX},${chunkZ}`;
        
        // Calculate world position of chunk center
        const centerX = chunkX * this.chunkSize + this.chunkSize / 2;
        const centerZ = chunkZ * this.chunkSize + this.chunkSize / 2;
        
        // Skip chunks near the origin (playing area)
        const distanceFromOrigin = Math.sqrt(centerX * centerX + centerZ * centerZ);
        if (distanceFromOrigin < 40) {
            this.decorationChunks.set(chunkKey, chunkObjects);
            return;
        }
        
        // Generate more decorations
        const numTrees = Math.floor(Math.random() * 6) + 2; // Increased from 5+1 to 6+2
        const numRocks = Math.floor(Math.random() * 4); // Increased from 3 to 4
        const numFlowers = Math.floor(Math.random() * 5) + 3; // Increased from 2 to 5+3
        
        // Add trees
        for (let i = 0; i < numTrees; i++) {
            // Random position within chunk
            const x = centerX + (Math.random() - 0.5) * this.chunkSize * 0.9;
            const z = centerZ + (Math.random() - 0.5) * this.chunkSize * 0.9;
            const y = this.getHeightAt(x, z);
            
            // Create tree and add to scene
            const tree = this.createTree();
            tree.position.set(x, y, z);
            
            // Slightly random rotation and scale (bigger than before)
            tree.rotation.y = Math.random() * Math.PI * 2;
            const scale = 1.2 + Math.random() * 0.8; // Increased from 0.8 + random * 0.5
            tree.scale.set(scale, scale, scale);
            
            this.scene.add(tree);
            chunkObjects.push(tree);
        }
        
        // Add rocks
        for (let i = 0; i < numRocks; i++) {
            const x = centerX + (Math.random() - 0.5) * this.chunkSize * 0.8;
            const z = centerZ + (Math.random() - 0.5) * this.chunkSize * 0.8;
            const y = this.getHeightAt(x, z);
            
            const rock = this.createRock();
            rock.position.set(x, y, z);
            rock.rotation.y = Math.random() * Math.PI * 2;
            const scale = 0.6 + Math.random() * 0.9; // Increased from 0.5 + random * 0.7
            rock.scale.set(scale, scale, scale);
            
            this.scene.add(rock);
            chunkObjects.push(rock);
        }
        
        // Add flowers (was missing implementation before)
        for (let i = 0; i < numFlowers; i++) {
            const x = centerX + (Math.random() - 0.5) * this.chunkSize * 0.9;
            const z = centerZ + (Math.random() - 0.5) * this.chunkSize * 0.9;
            const y = this.getHeightAt(x, z);
            
            const flower = this.createFlower();
            flower.position.set(x, y, z);
            flower.rotation.y = Math.random() * Math.PI * 2;
            const scale = 0.8 + Math.random() * 0.4;
            flower.scale.set(scale, scale, scale);
            
            this.scene.add(flower);
            chunkObjects.push(flower);
        }
        
        // Store the chunk
        this.decorationChunks.set(chunkKey, chunkObjects);
    }
    
    createTree() {
        const tree = new THREE.Group();
        
        // Create a more detailed trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.6, 1.0, 5, 10);
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.1
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2.5;
        trunk.castShadow = true;
        tree.add(trunk);
        
        // Create more detailed foliage - multiple layers
        const foliageColors = [0x2E8B57, 0x3CB371, 0x228B22]; // Different shades of green
        
        // Bottom layer - wider
        const foliage1 = new THREE.Mesh(
            new THREE.ConeGeometry(4.5, 6, 10),
            new THREE.MeshStandardMaterial({
                color: foliageColors[0],
                roughness: 0.8
            })
        );
        foliage1.position.y = 5;
        foliage1.castShadow = true;
        tree.add(foliage1);
        
        // Middle layer
        const foliage2 = new THREE.Mesh(
            new THREE.ConeGeometry(3.8, 5, 10),
            new THREE.MeshStandardMaterial({
                color: foliageColors[1],
                roughness: 0.8
            })
        );
        foliage2.position.y = 8.5;
        foliage2.castShadow = true;
        tree.add(foliage2);
        
        // Top layer - narrower
        const foliage3 = new THREE.Mesh(
            new THREE.ConeGeometry(2.5, 5, 8),
            new THREE.MeshStandardMaterial({
                color: foliageColors[2],
                roughness: 0.8
            })
        );
        foliage3.position.y = 11.5;
        foliage3.castShadow = true;
        tree.add(foliage3);
        
        return tree;
    }
    
    createRock() {
        const rock = new THREE.Group();
        
        // Main rock - more detailed
        const rockGeometry = new THREE.DodecahedronGeometry(1.8, 1); // Increased size and detail
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.1
        });
        
        const mainRock = new THREE.Mesh(rockGeometry, rockMaterial);
        mainRock.castShadow = true;
        mainRock.position.y = 0.2; // Slightly raised
        rock.add(mainRock);
        
        // Add a smaller rock beside it for more natural look
        const smallRockGeometry = new THREE.DodecahedronGeometry(1, 0);
        const smallRock = new THREE.Mesh(smallRockGeometry, rockMaterial);
        smallRock.position.set(1.2, 0, 0.5);
        smallRock.scale.set(0.6, 0.6, 0.6);
        smallRock.rotation.set(Math.random(), Math.random(), Math.random());
        smallRock.castShadow = true;
        rock.add(smallRock);
        
        return rock;
    }
    
    createFlower() {
        const flower = new THREE.Group();
        
        // Randomly select flower color
        const flowerColors = [
            0xFFD700, // Yellow
            0xFF1493, // Pink
            0xFF6347, // Tomato
            0x9370DB, // Purple
            0xFF4500  // Orange Red
        ];
        const selectedColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        
        // Create stem
        const stemGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
        const stemMaterial = new THREE.MeshStandardMaterial({
            color: 0x228B22, // Green
            roughness: 0.8
        });
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = 0.6;
        stem.castShadow = true;
        flower.add(stem);
        
        // Create flower head
        const petalGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const petalMaterial = new THREE.MeshStandardMaterial({
            color: selectedColor,
            roughness: 0.7,
            metalness: 0.1
        });
        
        // Center of flower
        const centerGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const centerMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFF00, // Yellow center
            roughness: 0.7
        });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.position.y = 1.25;
        center.castShadow = true;
        flower.add(center);
        
        // Create petals in a circle
        const numPetals = 6;
        const radius = 0.25;
        for (let i = 0; i < numPetals; i++) {
            const angle = (i / numPetals) * Math.PI * 2;
            const petal = new THREE.Mesh(petalGeometry, petalMaterial);
            petal.position.set(
                Math.cos(angle) * radius,
                1.25,
                Math.sin(angle) * radius
            );
            petal.castShadow = true;
            flower.add(petal);
        }
        
        return flower;
    }
} 