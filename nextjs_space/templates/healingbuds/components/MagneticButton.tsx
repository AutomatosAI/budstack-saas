'use client';

import React, { useRef, useEffect, useState } from 'react';

interface MagneticButtonProps {
    children: React.ReactNode;
    className?: string;
    magneticStrength?: number;
    onClick?: () => void;
}

const MagneticButton = ({
    children,
    className = '',
    magneticStrength = 0.3,
    onClick
}: MagneticButtonProps) => {
    const buttonRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const button = buttonRef.current;
        if (!button) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = button.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const deltaX = e.clientX - centerX;
            const deltaY = e.clientY - centerY;

            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 150;

            if (distance < maxDistance) {
                const strength = (maxDistance - distance) / maxDistance;
                setPosition({
                    x: deltaX * strength * magneticStrength,
                    y: deltaY * strength * magneticStrength
                });
            } else {
                setPosition({ x: 0, y: 0 });
            }
        };

        const handleMouseLeave = () => {
            setPosition({ x: 0, y: 0 });
        };

        window.addEventListener('mousemove', handleMouseMove);
        button.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            button.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [magneticStrength]);

    return (
        <div
            ref={buttonRef}
            className={className}
            onClick={onClick}
            style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: 'transform 0.2s ease-out'
            }}
        >
            {children}
        </div>
    );
};

export default MagneticButton;
