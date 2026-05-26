document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let currentAnimation = 0;
    let animationFrameId;
    let particlesArray = [];
    let hue = 0;
    
    // Mouse tracking
    let mouse = { x: undefined, y: undefined, radius: 150, vx: 0, vy: 0 };
    let lastMouse = { x: undefined, y: undefined };
    
    window.addEventListener('mousemove', (e) => {
        lastMouse.x = mouse.x;
        lastMouse.y = mouse.y;
        mouse.x = e.x;
        mouse.y = e.y;
        mouse.vx = mouse.x - lastMouse.x;
        mouse.vy = mouse.y - lastMouse.y;
        
        // Emit particles for mode 1 (Fluid Magic Trails)
        if(currentAnimation === 1) {
            for(let i=0; i<3; i++) {
                particlesArray.push(new TrailParticle(mouse.x, mouse.y));
            }
        }
    });
    
    window.addEventListener('mouseout', () => {
        mouse.x = undefined;
        mouse.y = undefined;
    });
    
    window.addEventListener('changeBgAnimation', (e) => {
        currentAnimation = e.detail;
        initAnimation();
    });
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initAnimation();
    }
    window.addEventListener('resize', resizeCanvas);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // --- Mode 0: Interactive Galaxy ---
    class GalaxyParticle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.baseX = this.x;
            this.baseY = this.y;
            this.density = (Math.random() * 30) + 1;
            this.color = `hsl(${Math.random() * 60 + 200}, 100%, 50%)`;
            this.angle = Math.random() * Math.PI * 2;
            this.velocity = Math.random() * 0.02 + 0.005;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        update() {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            if (mouse.x && distance < 300) {
                // Orbit mouse
                this.angle += this.velocity * 3;
                this.x = mouse.x - Math.cos(this.angle) * distance;
                this.y = mouse.y - Math.sin(this.angle) * distance;
                this.size = 3;
            } else {
                // Return to base slowly
                if(this.x !== this.baseX) {
                    let dxBase = this.baseX - this.x;
                    this.x += dxBase/20;
                }
                if(this.y !== this.baseY) {
                    let dyBase = this.baseY - this.y;
                    this.y += dyBase/20;
                }
                this.size = Math.max(0.5, this.size - 0.1);
            }
        }
    }

    // --- Mode 1: Fluid Magic Trails ---
    class TrailParticle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 15 + 5;
            this.speedX = Math.random() * 3 - 1.5 + (mouse.vx ? mouse.vx * 0.1 : 0);
            this.speedY = Math.random() * 3 - 1.5 + (mouse.vy ? mouse.vy * 0.1 : 0);
            this.color = `hsl(${hue}, 100%, 50%)`;
            this.life = 1.0;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.life;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life -= 0.02;
            this.size *= 0.95;
        }
    }

    // --- Mode 2: Liquid Orbs ---
    class OrbParticle {
        constructor() {
            this.size = Math.random() * 40 + 20;
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.speedX = Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
            this.color = `hsla(${Math.random() * 60 + 260}, 100%, 60%, 0.5)`;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if(this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if(this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx*dx + dy*dy);
            if(mouse.x && distance < 200) {
                const force = (200 - distance) / 200;
                this.x -= (dx / distance) * force * 15;
                this.y -= (dy / distance) * force * 15;
            }
        }
    }

    // --- Mode 3: Atomic Bonds ---
    class AtomParticle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.charge = Math.random() > 0.5 ? 1 : -1; // 1 = positive (red), -1 = negative (blue)
            this.size = this.charge === 1 ? 4 : 2; 
            this.vx = (Math.random() - 0.5) * 1.5;
            this.vy = (Math.random() - 0.5) * 1.5;
            this.color = this.charge === 1 ? '#ff3366' : '#00d2ff';
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            if(this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if(this.y < 0 || this.y > canvas.height) this.vy *= -1;
            
            if(mouse.x) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx*dx + dy*dy);
                
                if(distance < 250) {
                    const force = (250 - distance) / 3000;
                    if(this.charge === 1) {
                        this.vx += dx * force;
                        this.vy += dy * force;
                    } else {
                        this.vx -= dx * force;
                        this.vy -= dy * force;
                    }
                }
            }
            
            this.vx *= 0.98;
            this.vy *= 0.98;
            
            if(Math.abs(this.vx) < 0.1) this.vx += (Math.random() - 0.5) * 0.5;
            if(Math.abs(this.vy) < 0.1) this.vy += (Math.random() - 0.5) * 0.5;
        }
    }

    // --- Mode 4: Electric Connections ---
    class NodeParticle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = Math.random() * 1 - 0.5;
            this.vy = Math.random() * 1 - 0.5;
            this.size = 2;
        }
        draw() {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if(this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if(this.y < 0 || this.y > canvas.height) this.vy *= -1;
            
            // Attract slightly to mouse
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx*dx + dy*dy);
            if(mouse.x && distance < 150) {
                this.x += dx * 0.01;
                this.y += dy * 0.01;
            }
        }
    }

    function initAnimation() {
        particlesArray = [];
        cancelAnimationFrame(animationFrameId);
        
        let numParticles = 0;
        if(currentAnimation === 0) {
            numParticles = 300;
            for(let i=0; i<numParticles; i++) particlesArray.push(new GalaxyParticle());
        } else if(currentAnimation === 1) {
            // Particles generated on mousemove
        } else if(currentAnimation === 2) {
            numParticles = 40;
            for(let i=0; i<numParticles; i++) particlesArray.push(new OrbParticle());
        } else if(currentAnimation === 3) {
            numParticles = 150;
            for(let i=0; i<numParticles; i++) particlesArray.push(new AtomParticle());
        } else if(currentAnimation === 4) {
            numParticles = 100;
            for(let i=0; i<numParticles; i++) particlesArray.push(new NodeParticle());
        }
        animate();
    }
    
    function animate() {
        ctx.fillStyle = 'rgba(15, 17, 26, 0.2)'; // Trailing effect
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        hue += 2;
        mouse.vx = 0;
        mouse.vy = 0; // Reset velocities per frame if mouse stops
        
        if(currentAnimation === 1) {
            for(let i=0; i<particlesArray.length; i++) {
                particlesArray[i].update();
                particlesArray[i].draw();
                if(particlesArray[i].life <= 0) {
                    particlesArray.splice(i, 1);
                    i--;
                }
            }
        } else if(currentAnimation === 3) {
            for(let i=0; i<particlesArray.length; i++) {
                particlesArray[i].update();
                particlesArray[i].draw();
                
                for(let j=i+1; j<particlesArray.length; j++) {
                    let dx = particlesArray[i].x - particlesArray[j].x;
                    let dy = particlesArray[i].y - particlesArray[j].y;
                    let distance = Math.sqrt(dx*dx + dy*dy);
                    
                    if(distance < 100) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - distance/100})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
                        ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
                        ctx.stroke();
                    }
                }
                
                if(mouse.x) {
                    let dx = mouse.x - particlesArray[i].x;
                    let dy = mouse.y - particlesArray[i].y;
                    let distance = Math.sqrt(dx*dx + dy*dy);
                    if(distance < 150) {
                        ctx.beginPath();
                        ctx.strokeStyle = particlesArray[i].charge === 1 ? `rgba(255, 51, 102, ${1 - distance/150})` : `rgba(0, 210, 255, ${1 - distance/150})`;
                        ctx.lineWidth = 2;
                        ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
            }
        } else if(currentAnimation === 4) {
            for(let i=0; i<particlesArray.length; i++) {
                particlesArray[i].update();
                particlesArray[i].draw();
                
                // Draw electric lines to mouse
                if(mouse.x) {
                    let dx = mouse.x - particlesArray[i].x;
                    let dy = mouse.y - particlesArray[i].y;
                    let distance = Math.sqrt(dx*dx + dy*dy);
                    if(distance < 200) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(0, 210, 255, ${1 - distance/200})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(mouse.x, mouse.y);
                        ctx.lineTo(particlesArray[i].x, particlesArray[i].y);
                        ctx.stroke();
                    }
                }
            }
        } else {
            for(let i=0; i<particlesArray.length; i++) {
                particlesArray[i].update();
                particlesArray[i].draw();
            }
        }
        
        animationFrameId = requestAnimationFrame(animate);
    }
    
    initAnimation();
});
