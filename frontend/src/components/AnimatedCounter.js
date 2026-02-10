// AnimatedCounter - Counts from 0 to target value with easing
import { useState, useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

const AnimatedCounter = ({
    value,
    duration = 1500,
    delay = 0,
    prefix = '',
    suffix = '',
    className = ''
}) => {
    const [displayValue, setDisplayValue] = useState(0);
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, amount: 0.5 });
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (!isInView || hasAnimated.current) return;
        hasAnimated.current = true;

        const numericValue = typeof value === 'number' ? value : parseInt(value, 10);
        if (isNaN(numericValue) || numericValue === 0) {
            setDisplayValue(value);
            return;
        }

        const startTime = Date.now() + delay;
        let animationFrame;

        const animate = () => {
            const now = Date.now();
            if (now < startTime) {
                animationFrame = requestAnimationFrame(animate);
                return;
            }

            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutExpo(progress);
            const currentValue = Math.round(easedProgress * numericValue);

            setDisplayValue(currentValue);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [isInView, value, duration, delay]);

    return (
        <span ref={ref} className={className}>
            {prefix}{displayValue}{suffix}
        </span>
    );
};

export default AnimatedCounter;
