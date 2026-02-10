import React, { useRef, useEffect } from 'react';

const ParticleNetwork = ({
    particleColor = 'rgba(1, 107, 194, 0.5)',
    lineColor = 'rgba(1, 107, 194, 0.15)',
    particleCount = 50,
    interactionDistance = 150,
    className = ''
}) => {
    const canvasRef = useRef(null);
    const particles = useRef([]);
    const animationFrameId = useRef(null);
    const mouse = useRef({ x: null, y: null });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        const initParticles = () => {
            particles.current = [];
            for (let i = 0; i < particleCount; i++) {
                particles.current.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    size: Math.random() * 2 + 1
                });
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.current.forEach((p, i) => {
                // Move particles
                p.x += p.vx;
                p.y += p.vy;

                // Bounce off edges
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                // Draw particle
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = particleColor;
                ctx.fill();

                // Connect particles
                for (let j = i + 1; j < particles.current.length; j++) {
                    const p2 = particles.current[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.strokeStyle = lineColor;
                        ctx.lineWidth = 1 - dist / 120;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }

                // Mouse interaction
                if (mouse.current.x != null) {
                    const dx = p.x - mouse.current.x;
                    const dy = p.y - mouse.current.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < interactionDistance) {
                        const angle = Math.atan2(dy, dx);
                        const force = (interactionDistance - dist) / interactionDistance;
                        p.vx += Math.cos(angle) * force * 0.05;
                        p.vy += Math.sin(angle) * force * 0.05;
                    }
                }
            });

            animationFrameId.current = requestAnimationFrame(animate);
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Mouse tracking
        const handleMouseMove = (e) => {
            mouse.current.x = e.clientX;
            mouse.current.y = e.clientY;
        };

        const handleMouseLeave = () => {
            mouse.current.x = null;
            mouse.current.y = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseLeave);

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseLeave);
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [particleColor, lineColor, particleCount, interactionDistance]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none'
            }}
        />
    );
};

export default ParticleNetwork;
