import React, { useState, useRef } from 'react';
import './SpotlightCard.css';

const SpotlightCard = ({
    children,
    className = '',
    spotlightColor = 'rgba(255, 255, 255, 0.1)',
    borderColor = 'rgba(255, 255, 255, 0.15)',
    ...props
}) => {
    const divRef = useRef(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e) => {
        if (!divRef.current) return;

        const rect = divRef.current.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseEnter = () => {
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`spotlight-card ${className}`}
            {...props}
        >
            <div
                className="spotlight-overlay"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`
                }}
            />
            <div
                className="spotlight-border"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${borderColor}, transparent 40%)`
                }}
            />
            <div className="spotlight-content">
                {children}
            </div>
        </div>
    );
};

export default SpotlightCard;
