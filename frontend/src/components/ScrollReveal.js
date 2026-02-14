// ScrollReveal - Scroll-triggered animation wrapper using Framer Motion
import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const variants = {
    fadeUp: {
        hidden: { opacity: 0, y: 60 },
        visible: { opacity: 1, y: 0 }
    },
    fadeDown: {
        hidden: { opacity: 0, y: -60 },
        visible: { opacity: 1, y: 0 }
    },
    fadeLeft: {
        hidden: { opacity: 0, x: -60 },
        visible: { opacity: 1, x: 0 }
    },
    fadeRight: {
        hidden: { opacity: 0, x: 60 },
        visible: { opacity: 1, x: 0 }
    },
    scaleIn: {
        hidden: { opacity: 0, scale: 0.8 },
        visible: { opacity: 1, scale: 1 }
    },
    blur: {
        hidden: { opacity: 0, filter: 'blur(10px)' },
        visible: { opacity: 1, filter: 'blur(0px)' }
    }
};

const ScrollReveal = ({
    children,
    direction = 'fadeUp',
    delay = 0,
    duration = 0.6,
    threshold = 0.2,
    once = true,
    className = '',
    style = {}
}) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once, amount: threshold });

    const selectedVariant = variants[direction] || variants.fadeUp;

    return (
        <motion.div
            ref={ref}
            className={className}
            style={style}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={selectedVariant}
            transition={{
                duration,
                delay,
                ease: [0.25, 0.46, 0.45, 0.94]
            }}
        >
            {children}
        </motion.div>
    );
};

// Stagger container for child animations
export const StaggerContainer = ({
    children,
    staggerDelay = 0.1,
    threshold = 0.2,
    once = true,
    className = '',
    style = {}
}) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once, amount: threshold });

    return (
        <motion.div
            ref={ref}
            className={className}
            style={style}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={{
                hidden: {},
                visible: {
                    transition: {
                        staggerChildren: staggerDelay
                    }
                }
            }}
        >
            {children}
        </motion.div>
    );
};

// Individual stagger item (use inside StaggerContainer)
export const StaggerItem = ({
    children,
    direction = 'fadeUp',
    duration = 0.5,
    className = '',
    style = {}
}) => {
    const selectedVariant = variants[direction] || variants.fadeUp;

    return (
        <motion.div
            className={className}
            style={style}
            variants={selectedVariant}
            transition={{ duration, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
            {children}
        </motion.div>
    );
};

export default ScrollReveal;
