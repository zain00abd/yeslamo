"use client";

import { useState, useRef, useEffect } from "react";
import "./driver.css";

export default function SwipeToAccept({ onAccept, isLoading, disabled = false, disabledHint }) {
    const [position, setPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);
    const buttonRef = useRef(null);

    const maxSwipe = useRef(0);

    useEffect(() => {
        if (containerRef.current && buttonRef.current) {
            maxSwipe.current = containerRef.current.clientWidth - buttonRef.current.clientWidth - 6;
        }
    }, []);

    // Reset position if loading state finishes and resets
    useEffect(() => {
        if (!isLoading) {
            setPosition(0);
        }
    }, [isLoading]);

    const handleStart = (clientX) => {
        if (isLoading || disabled) return;
        setIsDragging(true);
    };

    const handleMove = (clientX) => {
        if (!isDragging || isLoading || disabled) return;

        // Calculate new position relative to container
        const rect = containerRef.current.getBoundingClientRect();
        let newPos = clientX - rect.left - (buttonRef.current.clientWidth / 2);

        // Bound the position
        if (newPos < 0) newPos = 0;
        if (newPos > maxSwipe.current) newPos = maxSwipe.current;

        setPosition(newPos);
    };

    const handleEnd = () => {
        if (!isDragging || isLoading || disabled) return;
        setIsDragging(false);

        // If swiped more than 80%, accept
        if (position > maxSwipe.current * 0.8) {
            setPosition(maxSwipe.current);
            onAccept();
        } else {
            // Otherwise snap back
            setPosition(0);
        }
    };

    // Mouse Events
    const onMouseDown = (e) => handleStart(e.clientX);
    const onMouseMove = (e) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();

    // Touch Events
    const onTouchStart = (e) => handleStart(e.touches[0].clientX);
    const onTouchMove = (e) => {
        // Prevent scrolling while dragging
        e.preventDefault();
        handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => handleEnd();

    const progressWidth = position + (buttonRef.current ? buttonRef.current.clientWidth / 2 : 25);

    return (
        <div
            className={`swipe-container${disabled ? " swipe-container--disabled" : ""}`}
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
        >
            <div
                className="swipe-progress"
                style={{ width: `${progressWidth}px`, transition: isDragging ? 'none' : 'width 0.3s ease' }}
            />

            <div className="swipe-text">
                {disabled
                    ? disabledHint || "لا يمكن القبول حالياً"
                    : isLoading
                      ? "جاري القبول..."
                      : "اسحب للقبول >>"}
            </div>

            <div
                className="swipe-button"
                ref={buttonRef}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                style={{
                    transform: `translateX(${position}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s ease'
                }}
            >
                {isLoading ? (
                    <div style={{ width: 20, height: 20, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                ) : (
                    <svg viewBox="0 0 24 24">
                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                    </svg>
                )}
            </div>

            <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
