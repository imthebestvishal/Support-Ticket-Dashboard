import React, { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ScrollShowcaseProps {
  totalFrames: number;
  imagePath: (index: number) => string;
}

export default function ScrollShowcase({ totalFrames, imagePath }: ScrollShowcaseProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [preloadingProgress, setPreloadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Scroll state is the source of truth so playback does not depend on scroll speed.
  const animRef = useRef({
    frame: 1,
    progress: 0,
  });

  // 1. Preload sequence frames progressively
  useEffect(() => {
    let loadedCount = 0;
    const tempImages: HTMLImageElement[] = [];

    const handleImageLoad = () => {
      loadedCount++;
      const percent = Math.round((loadedCount / totalFrames) * 100);
      setPreloadingProgress(percent);

      if (loadedCount === totalFrames) {
        setImages(tempImages);
        setIsLoaded(true);
      }
    };

    const handleImageError = (path: string) => {
      console.warn(`Failed to preload frame: ${path}`);
      handleImageLoad(); // Count as loaded to prevent lock
    };

    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const srcPath = imagePath(i);
      img.onload = handleImageLoad;
      img.onerror = () => handleImageError(srcPath);
      img.src = srcPath;
      tempImages.push(img);
    }
  }, [totalFrames, imagePath]);

  // 2. Monitor scroll and calculate the exact frame for the current position
  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const totalScrollHeight = container.scrollHeight - viewportHeight;

      const scrollTop = -rect.top;

      let progress = totalScrollHeight > 0 ? scrollTop / totalScrollHeight : 0;
      progress = Math.max(0, Math.min(1, progress));

      animRef.current.progress = progress;
      animRef.current.frame = Math.max(
        1,
        Math.min(totalFrames, Math.floor(progress * (totalFrames - 1)) + 1)
      );
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll(); // Trigger initial calc

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isLoaded, totalFrames]);

  // 3. Render Canvas Loop
  useEffect(() => {
    if (!isLoaded || images.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale transform before re-applying
        ctx.scale(dpr, dpr);
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const drawFrame = (frameIndex: number) => {
      const img = images[frameIndex - 1];
      if (!img || !img.complete) return;

      const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
      const canvasHeight = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const shouldContainFrame = window.innerWidth <= 768;
      const imgRatio = img.width / img.height;
      const canvasRatio = canvasWidth / canvasHeight;

      let drawW = canvasWidth;
      let drawH = canvasHeight;
      let x = 0;
      let y = 0;

      if (shouldContainFrame ? imgRatio > canvasRatio : imgRatio <= canvasRatio) {
        drawW = canvasWidth;
        drawH = canvasWidth / imgRatio;
        y = shouldContainFrame ? (canvasHeight - drawH) * 0.22 : (canvasHeight - drawH) / 2;
      } else {
        drawH = canvasHeight;
        drawW = canvasHeight * imgRatio;
        x = (canvasWidth - drawW) / 2;
      }

      ctx.drawImage(img, x, y, drawW, drawH);
    };

    const renderLoop = () => {
      const anim = animRef.current;
      const frame = anim.frame;

      drawFrame(frame);

      // Lock overlays and fades directly to the user's scrollbar progress
      const renderedProgress = anim.progress;

      // A. Update Floating Left Brand Title Opacity smoothly based on rendered frame
      if (titleRef.current) {
        const titleOpacity = renderedProgress < 0.12 ? 1 - (renderedProgress / 0.12) : 0;
        titleRef.current.style.opacity = String(titleOpacity);
        titleRef.current.style.visibility = titleOpacity > 0.02 ? "visible" : "hidden";
      }

      // B. Update canvas container opacity based on rendered frame
      const canvasOpacity = renderedProgress > 0.90 ? 1 - ((renderedProgress - 0.90) / 0.10) : 1;
      const canvasSide = canvas.parentElement?.parentElement; // .scroll-showcase-canvas-side
      if (canvasSide) {
        canvasSide.style.opacity = String(canvasOpacity);
      }

      // C. Update Signup Card visibility based on rendered frame
      const signupCard = containerRef.current?.querySelector(".scroll-showcase-signup-card") as HTMLDivElement | null;
      if (signupCard) {
        if (renderedProgress >= 0.90) {
          signupCard.classList.add("active");
        } else {
          signupCard.classList.remove("active");
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animId);
    };
  }, [isLoaded, images]);

  if (!isLoaded) {
    return (
      <div className="sequence-preloader-container">
        <div className="preloader-content">
          <div className="preloader-spinner-wrapper">
            <div className="preloader-spinner"></div>
            <span className="preloader-percent">{preloadingProgress}%</span>
          </div>
          <h3>Optimizing workspace showcase...</h3>
          <p>Preloading experience frames for smooth scrolling</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="scroll-showcase-container">
      <div className="scroll-showcase-sticky">
        <div className="scroll-showcase-split">
          
          {/* Floating Left Brand Title (fades out as scroll starts) */}
          <div ref={titleRef} className="scroll-showcase-left-title">
            <h1>
              <span className="title-base">Support</span>
              <br />
              <span className="title-accent">Hub</span>
            </h1>
          </div>

          {/* Step 4: Centered Brand Signup Card overlay at the very end of scroll */}
          <div className="scroll-showcase-signup-card">
            <p className="landing-kicker">AI email operations</p>
            <h1 className="hero-title">
              <span className="title-base">Support</span>{" "}
              <span className="title-accent">Hub</span>
            </h1>
            <div className="hero-divider-bar" aria-hidden="true" />
            <h2 className="hero-subtitle" style={{ fontSize: "28px" }}>
              One stop solution for{" "}
              <span className="highlight-green">Real Time Email Analysis</span>
            </h2>
            <p className="hero-description" style={{ fontSize: "14px", lineHeight: "1.6", maxWidth: "100%", margin: "0 auto 28px" }}>
              A minimal AI-powered support workspace that analyzes customer emails,
              prioritizes urgency, drafts better replies, and keeps follow-up work visible.
            </p>
            <button onClick={() => navigate("/auth?mode=signup")} className="hero-cta-button" style={{ display: "inline-flex", marginTop: "0" }}>
              <span>Sign Up</span>
              <span className="arrow-icon" aria-hidden="true">→</span>
            </button>
          </div>

          {/* Right Sticky Canvas Render */}
          <div className="scroll-showcase-canvas-side">
            <div className="canvas-wrapper">
              <canvas ref={canvasRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
