// PageTransition - Smooth route transition wrapper
import React from 'react';
import { motion } from 'framer-motion';

const pageVariants = {
    initial: {
        opacity: 0,
        y: 20,
        filter: 'blur(4px)'
    },
    animate: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)'
    },
    exit: {
        opacity: 0,
        y: -20,
        filter: 'blur(4px)'
    }
};

const pageTransition = {
    type: 'tween',
    ease: [0.25, 0.46, 0.45, 0.94],
    duration: 0.35
};

const PageTransition = ({ children, className = '' }) => {
    return (
        <motion.div
            className={className}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={pageTransition}
            style={{ width: '100%', minHeight: '100vh' }}
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
