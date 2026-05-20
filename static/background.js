document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Mouse interaction
    let mouse = { x: null, y: null, radius: 150 };
    
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.x;
        mouse.y = e.y;
    });
    
    window.addEventListener('mouseout', () => {
        mouse.x = undefined;
        mouse.y = undefined;
    });
    
    // Particles Array
    let particlesArray = [];
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.baseX = this.x;
            this.baseY = this.y;
            this.density = (Math.random() * 30) + 1;
            this.speedX = Math.random() * 0.8 - 0.4;
            this.speedY = Math.random() * 0.8 - 0.4;
            
            // Randomly assign primary (purple) or secondary (blue) color
            this.color = Math.random() > 0.5 ? '138, 43, 226' : '0, 210, 255';
        }
        
        draw() {
            ctx.fillStyle = `rgba(${this.color}, 0.8)`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
        }
        
        update() {
            // Move particles
            this.x += this.speedX;
            this.y += this.speedY;
            
            // Bounce off edges
            if (this.x < 0 || this.x > canvas.width) this.speedX = -this.speedX;
            if (this.y < 0 || this.y > canvas.height) this.speedY = -this.speedY;
            
            // Mouse Interaction - Repel
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            if (mouse.x && mouse.y && distance < mouse.radius) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const maxDistance = mouse.radius;
                const force = (maxDistance - distance) / maxDistance;
                const directionX = forceDirectionX * force * this.density * 0.05;
                const directionY = forceDirectionY * force * this.density * 0.05;
                
                this.x -= directionX;
                this.y -= directionY;
            }
        }
    }
    
    function init() {
        particlesArray = [];
        let numberOfParticles = (canvas.width * canvas.height) / 9000;
        // Cap particles for performance
        numberOfParticles = Math.min(numberOfParticles, 120);
        
        for (let i = 0; i < numberOfParticles; i++) {
            particlesArray.push(new Particle());
        }
    }
    
    function connect() {
        let opacityValue = 1;
        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a; b < particlesArray.length; b++) {
                let dx = particlesArray[a].x - particlesArray[b].x;
                let dy = particlesArray[a].y - particlesArray[b].y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 120) {
                    opacityValue = 1 - (distance / 120);
                    // Create gradient line between the two particle colors
                    let gradient = ctx.createLinearGradient(particlesArray[a].x, particlesArray[a].y, particlesArray[b].x, particlesArray[b].y);
                    gradient.addColorStop(0, `rgba(${particlesArray[a].color}, ${opacityValue * 0.4})`);
                    gradient.addColorStop(1, `rgba(${particlesArray[b].color}, ${opacityValue * 0.4})`);
                    
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
            
            // Connect to mouse
            if (mouse.x && mouse.y) {
                let dxMouse = particlesArray[a].x - mouse.x;
                let dyMouse = particlesArray[a].y - mouse.y;
                let distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
                
                if (distanceMouse < mouse.radius) {
                    let opacityMouse = 1 - (distanceMouse / mouse.radius);
                    ctx.strokeStyle = `rgba(${particlesArray[a].color}, ${opacityMouse * 0.8})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }
        }
    }
    
    function animate() {
        requestAnimationFrame(animate);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }
        connect();
    }
    
    init();
    animate();
});
