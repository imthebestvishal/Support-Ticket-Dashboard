import React, { useRef, useEffect, useState } from "react";

interface ScrollShowcaseProps {
  totalFrames: number;
  imagePath: (index: number) => string;
}

export default function ScrollShowcase({ totalFrames, imagePath }: ScrollShowcaseProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  
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

      // Fade every non-sequence overlay away as soon as the scroll animation begins.
      if (overlayRef.current) {
        const overlayOpacity = renderedProgress < 0.10 ? 1 - (renderedProgress / 0.10) : 0;
        overlayRef.current.style.opacity = String(overlayOpacity);
        overlayRef.current.style.visibility = overlayOpacity > 0.02 ? "visible" : "hidden";
        overlayRef.current.style.pointerEvents = overlayOpacity > 0.65 ? "auto" : "none";
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
          <div ref={overlayRef} className="scroll-showcase-intro-overlay" aria-hidden="true">
            <div className="scroll-showcase-hero-copy">
              <h1>
                <span>Senti</span>
                <strong>Mail</strong>
              </h1>
              <p>
                All your support tickets, emails, and conversations in one place.
                Stay organized, respond faster, and deliver exceptional support.
              </p>
            </div>

            <div className="scroll-showcase-card floating-card mail-card">
              <span className="scroll-showcase-card-icon mail-icon">M</span>
              <div>
                <strong>Senti Mail</strong>
                <p>All emails & tickets in one unified view.</p>
              </div>
            </div>

            <div className="scroll-showcase-card floating-card insights-card">
              <span className="scroll-showcase-card-icon insights-icon">I</span>
              <div>
                <strong>Smart Insights</strong>
                <p>Get AI-powered insights and ticket summaries.</p>
              </div>
            </div>

            <div className="scroll-showcase-card floating-card response-card">
              <span className="scroll-showcase-card-icon response-icon">F</span>
              <div>
                <strong>Faster Response</strong>
                <p>Automate workflows and reply in seconds.</p>
              </div>
            </div>

            <div className="scroll-showcase-card floating-card deadline-card">
              <span className="scroll-showcase-card-icon deadline-icon">D</span>
              <div>
                <strong>Deadline Alerts</strong>
                <p>Spot time-sensitive emails before follow-ups slip.</p>
              </div>
            </div>

            <span className="scroll-showcase-dots dots-left" />
            <span className="scroll-showcase-dots dots-right" />
            <span className="scroll-showcase-connector connector-top" />
            <span className="scroll-showcase-connector connector-right" />
          </div>

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
