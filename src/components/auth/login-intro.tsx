"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const INTRO_MS = 3000;
const FADE_MS = 700;

/**
 * Visual-only entrance for the login page: shows the VIP TUNING logo centered
 * full-screen for ~3s, then crossfades into the login panel. The panel (and its
 * real form) is always mounted underneath — the overlay only covers it briefly
 * and never delays any auth request. After the fade it is removed from the DOM.
 */
export function LoginIntro({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setDone(true), INTRO_MS);
    const t2 = setTimeout(() => setGone(true), INTRO_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <>
      {!gone ? (
        <div
          aria-hidden
          className={`fixed inset-0 z-50 flex items-center justify-center bg-background px-6 transition-opacity duration-700 ${
            done ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <Image
            src="/vip-tuning-logo.png"
            alt="VIP TUNING"
            width={1416}
            height={246}
            priority
            className="h-12 w-auto duration-1000 animate-in fade-in zoom-in-95 sm:h-16"
          />
        </div>
      ) : null}

      <div
        className={`transition-opacity duration-700 ${
          done ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>
    </>
  );
}
