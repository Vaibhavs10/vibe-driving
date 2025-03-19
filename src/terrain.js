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
        
        // Create ground material with softer, more Ghibli-inspired colors
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xDDC9A9, // Softer, warmer earth tone
            roughness: 0.8,
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
            
            // Simplifed multi-octave noise with more Ghibli-like rolling hills
            let height = 0;
            height += this.simplifiedNoise(nx * 1.2, nz * 1.2) * 9; // Increased amplitude for more pronounced hills
            height += this.simplifiedNoise(nx * 4, nz * 4) * 2.5;   // Medium details
            height += this.simplifiedNoise(nx * 12, nz * 12) * 0.4; // Small details, reduced for smoother appearance
            
            // Add occasional gentle hills (Ghibli style)
            const hillFactor = this.simplifiedNoise(nx * 0.5, nz * 0.5);
            if (hillFactor > 0.6) {
                height += 3 * (hillFactor - 0.6);
            }
            
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
        
        // Generate more decorations in Ghibli style - more grouped together for visual richness
        const numTrees = Math.floor(Math.random() * 7) + 3; // More trees
        const numRocks = Math.floor(Math.random() * 5) + 1; // More rocks, at least 1
        const numFlowers = Math.floor(Math.random() * 8) + 5; // Many more flowers for color
        
        // Add trees in more natural clusters
        const treeClusterX = centerX + (Math.random() - 0.5) * this.chunkSize * 0.5;
        const treeClusterZ = centerZ + (Math.random() - 0.5) * this.chunkSize * 0.5;
        
        for (let i = 0; i < numTrees; i++) {
            // Create more natural clustering of trees
            const clusterRadius = 15 + Math.random() * 20;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * clusterRadius;
            
            const x = treeClusterX + Math.cos(angle) * distance;
            const z = treeClusterZ + Math.sin(angle) * distance;
            const y = this.getHeightAt(x, z);
            
            // Create tree and add to scene
            const tree = this.createTree();
            tree.position.set(x, y, z);
            
            // More varied sizes for Ghibli style
            tree.rotation.y = Math.random() * Math.PI * 2;
            const scale = 1.1 + Math.random() * 1.2; // More varied and larger trees
            tree.scale.set(scale, scale + (Math.random() * 0.4 - 0.2), scale); // Slightly vary height independently
            
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
            const scale = 0.6 + Math.random() * 1.0; 
            rock.scale.set(scale, scale * (0.8 + Math.random() * 0.4), scale); // Vary height a bit
            
            this.scene.add(rock);
            chunkObjects.push(rock);
        }
        
        // Add flowers in more deliberate clusters, Ghibli style
        for (let cluster = 0; cluster < 3; cluster++) {
            const clusterX = centerX + (Math.random() - 0.5) * this.chunkSize * 0.8;
            const clusterZ = centerZ + (Math.random() - 0.5) * this.chunkSize * 0.8;
            
            const clusterSize = Math.floor(Math.random() * 5) + 3;
            
            for (let i = 0; i < clusterSize; i++) {
                const radius = 2 + Math.random() * 5;
                const angle = Math.random() * Math.PI * 2;
                
                const x = clusterX + Math.cos(angle) * radius;
                const z = clusterZ + Math.sin(angle) * radius;
                const y = this.getHeightAt(x, z);
                
                const flower = this.createFlower();
                flower.position.set(x, y, z);
                flower.rotation.y = Math.random() * Math.PI * 2;
                const scale = 0.9 + Math.random() * 0.5;
                flower.scale.set(scale, scale, scale);
                
                this.scene.add(flower);
                chunkObjects.push(flower);
            }
        }
        
        // Store the chunk
        this.decorationChunks.set(chunkKey, chunkObjects);
    }
    
    createTree() {
        const tree = new THREE.Group();
        
        // Create a more Ghibli-inspired trunk - slightly curved and tapered
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 1.2, 6, 12);
        // Add slight bend to trunk vertices
        const trunkPositions = trunkGeometry.attributes.position.array;
        for (let i = 0; i < trunkPositions.length; i += 3) {
            const y = trunkPositions[i + 1];
            // Apply gentle curve based on height
            const bendFactor = 0.1 * Math.pow((y + 3) / 6, 2);
            trunkPositions[i] += bendFactor;
        }
        trunkGeometry.attributes.position.needsUpdate = true;
        trunkGeometry.computeVertexNormals();
        
        // Warm, rich brown with slight red tint like Ghibli trees
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x8E5E3F,
            roughness: 0.9,
            metalness: 0.1
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 3;
        trunk.castShadow = true;
        tree.add(trunk);
        
        // Create Ghibli-inspired foliage - more rounded and puffy, warmer colors
        const foliageColors = [
            0x76A665, // Soft green with hint of blue
            0x8FBD6B, // Lighter yellow-green
            0x5A9E5A  // Slightly deeper green
        ];
        
        // Bottom layer - wider and rounder
        const foliage1 = new THREE.Mesh(
            new THREE.SphereGeometry(4.8, 10, 10),
            new THREE.MeshStandardMaterial({
                color: foliageColors[0],
                roughness: 0.8
            })
        );
        foliage1.position.y = 6;
        foliage1.scale.y = 0.9; // Slightly flatten
        foliage1.castShadow = true;
        tree.add(foliage1);
        
        // Middle layer - also round
        const foliage2 = new THREE.Mesh(
            new THREE.SphereGeometry(3.5, 10, 10),
            new THREE.MeshStandardMaterial({
                color: foliageColors[1],
                roughness: 0.8
            })
        );
        foliage2.position.y = 9;
        foliage2.scale.y = 0.85;
        foliage2.castShadow = true;
        tree.add(foliage2);
        
        // Top layer - smaller round top
        const foliage3 = new THREE.Mesh(
            new THREE.SphereGeometry(2.2, 10, 10),
            new THREE.MeshStandardMaterial({
                color: foliageColors[2],
                roughness: 0.8
            })
        );
        foliage3.position.y = 11.5;
        foliage3.scale.y = 0.9;
        foliage3.castShadow = true;
        tree.add(foliage3);
        
        return tree;
    }
    
    createRock() {
        const rock = new THREE.Group();
        
        // Main rock - more organic, Ghibli-inspired shapes
        const rockGeometry = new THREE.DodecahedronGeometry(1.8, 2); // More subdivision for smooth look
        
        // Apply some random gentle deformation to make it more natural
        const rockPositions = rockGeometry.attributes.position.array;
        for (let i = 0; i < rockPositions.length; i += 3) {
            const noise = 0.1 * (Math.random() - 0.5);
            rockPositions[i] *= 1 + noise;
            rockPositions[i + 1] *= 1 + noise;
            rockPositions[i + 2] *= 1 + noise;
        }
        rockGeometry.attributes.position.needsUpdate = true;
        rockGeometry.computeVertexNormals();
        
        // Warmer gray with hint of warmth like Ghibli rocks
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x9E9A93, // Warmer gray with slight brown tint
            roughness: 0.8,
            metalness: 0.1
        });
        
        const mainRock = new THREE.Mesh(rockGeometry, rockMaterial);
        mainRock.castShadow = true;
        mainRock.position.y = 0.2;
        rock.add(mainRock);
        
        // Add a smaller rock beside it for more natural look
        const smallRockGeometry = new THREE.DodecahedronGeometry(1, 1);
        // Apply similar deformation
        const smallRockPositions = smallRockGeometry.attributes.position.array;
        for (let i = 0; i < smallRockPositions.length; i += 3) {
            const noise = 0.15 * (Math.random() - 0.5);
            smallRockPositions[i] *= 1 + noise;
            smallRockPositions[i + 1] *= 1 + noise;
            smallRockPositions[i + 2] *= 1 + noise;
        }
        smallRockGeometry.attributes.position.needsUpdate = true;
        smallRockGeometry.computeVertexNormals();
        
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
        
        // Ghibli-inspired flower colors - brighter, more vivid colors with warmth
        const flowerColors = [
            0xFFF899, // Sunny yellow
            0xFF6B97, // Warm pink
            0xFFAA5E, // Warm orange 
            0xC7F0FF, // Pale blue
            0xE085FF  // Lavender
        ];
        const selectedColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        
        // Create stem with slight curve
        const stemGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8);
        // Add slight bend to stem vertices
        const stemPositions = stemGeometry.attributes.position.array;
        for (let i = 0; i < stemPositions.length; i += 3) {
            const y = stemPositions[i + 1];
            // Apply gentle curve based on height
            const bendFactor = 0.06 * Math.pow((y + 0.65) / 1.3, 2);
            stemPositions[i] += bendFactor;
        }
        stemGeometry.attributes.position.needsUpdate = true;
        stemGeometry.computeVertexNormals();
        
        const stemMaterial = new THREE.MeshStandardMaterial({
            color: 0x7EC850, // Brighter green
            roughness: 0.8
        });
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = 0.65;
        stem.castShadow = true;
        flower.add(stem);
        
        // Create flower head with Ghibli-style round petals
        const petalGeometry = new THREE.SphereGeometry(0.18, 8, 8);
        const petalMaterial = new THREE.MeshStandardMaterial({
            color: selectedColor,
            roughness: 0.5, // Slightly glossier for vibrant look
            metalness: 0.05,
            emissive: selectedColor,
            emissiveIntensity: 0.1 // Subtle glow effect
        });
        
        // Center of flower
        const centerGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const centerMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFF80, // Brighter yellow center
            roughness: 0.5,
            emissive: 0xFFFF00,
            emissiveIntensity: 0.1
        });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.position.y = 1.3;
        center.castShadow = true;
        flower.add(center);
        
        // Create petals in a circle - more petals, more Ghibli-like
        const numPetals = 8; // More petals
        const radius = 0.26;
        for (let i = 0; i < numPetals; i++) {
            const angle = (i / numPetals) * Math.PI * 2;
            const petal = new THREE.Mesh(petalGeometry, petalMaterial);
            petal.position.set(
                Math.cos(angle) * radius,
                1.3, // Same height as center
                Math.sin(angle) * radius
            );
            
            // Rotate each petal to face outward
            petal.lookAt(new THREE.Vector3(
                petal.position.x * 2,
                1.3,
                petal.position.z * 2
            ));
            
            // Scale petals to be slightly elongated
            petal.scale.set(1.4, 1.0, 1.0);
            
            petal.castShadow = true;
            flower.add(petal);
        }
        
        return flower;
    }
} 