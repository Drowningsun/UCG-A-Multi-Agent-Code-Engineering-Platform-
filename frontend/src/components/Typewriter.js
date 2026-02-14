import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Typewriter = ({
    words = [],
    typeSpeed = 100,
    deleteSpeed = 50,
    delay = 1500,
    className = ''
}) => {
    const [text, setText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [loopNum, setLoopNum] = useState(0);
    const [typingSpeed, setTypingSpeed] = useState(typeSpeed);

    useEffect(() => {
        const i = loopNum % words.length;
        const fullText = words[i];

        const handleType = () => {
            setText(isDeleting
                ? fullText.substring(0, text.length - 1)
                : fullText.substring(0, text.length + 1)
            );

            setTypingSpeed(isDeleting ? deleteSpeed : typeSpeed);

            if (!isDeleting && text === fullText) {
                setTimeout(() => setIsDeleting(true), delay);
            } else if (isDeleting && text === '') {
                setIsDeleting(false);
                setLoopNum(loopNum + 1);
            }
        };

        const timer = setTimeout(handleType, typingSpeed);

        return () => clearTimeout(timer);
    }, [text, isDeleting, loopNum, words, typeSpeed, deleteSpeed, delay, typingSpeed]);

    return (
        <span className={className}>
            {text}
            <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                style={{ display: 'inline-block', marginLeft: '2px', color: 'var(--primary, #016bc2)' }}
            >
                |
            </motion.span>
        </span>
    );
};

export default Typewriter;
