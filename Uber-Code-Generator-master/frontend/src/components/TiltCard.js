import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

const TiltCard = ({
    children,
    className = '',
    maxRotation = 15,
    scale = 1.05,
    ...props
}) => {
    const ref = useRef(null);
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);
    const [isActive, setIsActive] = useState(false);

    const handleMouseMove = (e) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Calculate mouse position relative to center of card
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;

        setRotateX(yPct * -maxRotation); // Invert Y for correct tilt
        setRotateY(xPct * maxRotation);
    };

    const handleMouseEnter = () => {
        setIsActive(true);
    };

    const handleMouseLeave = () => {
        setIsActive(false);
        setRotateX(0);
        setRotateY(0);
    };

    return (
        <motion.div
            ref={ref}
            className={className}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            animate={{
                rotateX: isActive ? rotateX : 0,
                rotateY: isActive ? rotateY : 0,
                scale: isActive ? scale : 1,
            }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                mass: 0.8
            }}
            style={{
                transformStyle: 'preserve-3d',
                perspective: '1000px'
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export default TiltCard;
