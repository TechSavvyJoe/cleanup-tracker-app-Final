import React, { useEffect, useRef, useState } from 'react';

// Lightweight VIN-friendly scanner that supports QR, Code39, and Code128.
// Prefers native BarcodeDetector; falls back to ZXing library loaded dynamically.
export default function VinScanner({ onScanSuccess }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [error, setError] = useState('');
    const [active, setActive] = useState(false);
    const stopRef = useRef(() => {});

    useEffect(() => {
        let stream;
        let rafId;
        let detector;

        const startNative = async () => {
            // eslint-disable-next-line no-undef
            const supported = 'BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats?.()).length > 0;
            if (!supported) return false;
            try {
                // eslint-disable-next-line no-undef
                detector = new window.BarcodeDetector({ 
                    formats: ['qr_code', 'code_39', 'code_128', 'code_93', 'ean_13', 'ean_8', 'itf', 'pdf417', 'data_matrix'] 
                });
            } catch (e) {
                return false;
            }
            // Enhanced constraints for better wide barcode scanning
            const constraints = { 
                video: { 
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    zoom: { ideal: 1 }
                } 
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setActive(true);
            const tick = async () => {
                if (!videoRef.current) return;
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes && barcodes.length) {
                        const text = (barcodes[0].rawValue || barcodes[0].raw || '').trim().toUpperCase();
                        // Enhanced validation for VIN barcodes (accept 8+ characters for flexibility)
                        if (text && text.length >= 8) {
                            onScanSuccess(text);
                            stop();
                            return;
                        }
                    }
                } catch {}
                rafId = requestAnimationFrame(tick);
            };
            rafId = requestAnimationFrame(tick);
            stopRef.current = () => {
                cancelAnimationFrame(rafId);
                stream?.getTracks()?.forEach(t => t.stop());
                setActive(false);
            };
            return true;
        };

        const startZXing = async () => {
            // load ZXing on demand with enhanced multi-format support
            const scriptUrl = 'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js';
            await new Promise((resolve, reject) => {
                if (document.getElementById('zxing-lib')) return resolve();
                const s = document.createElement('script');
                s.src = scriptUrl; s.id = 'zxing-lib'; s.onload = resolve; s.onerror = reject; document.body.appendChild(s);
            });
            // eslint-disable-next-line no-undef
            const codeReader = new ZXing.BrowserMultiFormatReader();
            
            // Enhanced camera selection for better wide barcode scanning
            const videoInputDevices = await codeReader.listVideoInputDevices();
            const backCam = videoInputDevices.reverse().find(d => /back|rear|environment/i.test(d.label)) || videoInputDevices[0];
            
            // Set video constraints for better wide barcode detection
            if (videoRef.current) {
                videoRef.current.style.width = '100%';
                videoRef.current.style.height = 'auto';
            }
            
            setActive(true);
            await codeReader.decodeFromVideoDevice(
                backCam?.deviceId, 
                videoRef.current, 
                (result, err) => {
                    if (result) {
                        const scannedText = result.getText ? result.getText() : String(result.text || '');
                        // Enhanced VIN validation - accept various formats
                        if (scannedText && scannedText.length >= 8) {
                            onScanSuccess(scannedText.trim().toUpperCase());
                            stop();
                        }
                    }
                }
            );
            stopRef.current = () => {
                try { codeReader.reset(); } catch {}
                setActive(false);
            };
            return true;
        };

        const start = async () => {
            try {
                if (!(await startNative())) {
                    await startZXing();
                }
            } catch (e) {
                console.error(e);
                setError('Camera access or scanning failed. Check permissions.');
            }
        };
        start();

        const stop = () => stopRef.current();
        return () => {
            stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="w-full relative bg-black rounded-2xl overflow-hidden border border-x-border">
            <div className="relative aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

                {/* Enterprise-grade Scanner Overlay with X-style */}
                {active && (
                    <div className="absolute inset-0 pointer-events-none bg-black/30">
                        {/* Dimming overlay for focus */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60"></div>

                        {/* PRIMARY: Horizontal VIN Barcode Scanner - Centered */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-28">
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-x-green/20 rounded-2xl blur-xl animate-pulse"></div>

                            {/* Main scanning frame */}
                            <div className="absolute inset-0 border-4 border-x-green rounded-2xl bg-x-green/5 animate-glow shadow-glow-green">
                                {/* Label */}
                                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-x-green text-white px-6 py-2 rounded-xl text-base font-black uppercase tracking-wider shadow-glow-green animate-bounce-subtle">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        VIN Barcode Zone
                                    </div>
                                </div>

                                {/* Corner brackets - Enterprise style */}
                                <div className="absolute -top-3 -left-3 w-12 h-12 border-t-[6px] border-l-[6px] border-x-green rounded-tl-xl"></div>
                                <div className="absolute -top-3 -right-3 w-12 h-12 border-t-[6px] border-r-[6px] border-x-green rounded-tr-xl"></div>
                                <div className="absolute -bottom-3 -left-3 w-12 h-12 border-b-[6px] border-l-[6px] border-x-green rounded-bl-xl"></div>
                                <div className="absolute -bottom-3 -right-3 w-12 h-12 border-b-[6px] border-r-[6px] border-x-green rounded-br-xl"></div>

                                {/* Center alignment guides */}
                                <div className="absolute top-1/2 left-0 w-8 h-0.5 bg-x-green -translate-y-1/2"></div>
                                <div className="absolute top-1/2 right-0 w-8 h-0.5 bg-x-green -translate-y-1/2"></div>
                                <div className="absolute top-0 left-1/2 w-0.5 h-8 bg-x-green -translate-x-1/2"></div>
                                <div className="absolute bottom-0 left-1/2 w-0.5 h-8 bg-x-green -translate-x-1/2"></div>

                                {/* Animated scanning line */}
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-x-green to-transparent -translate-y-1/2 animate-pulse shadow-glow-green"></div>
                            </div>
                        </div>

                        {/* SECONDARY: QR Code Scanner - Top Right */}
                        <div className="absolute top-8 right-8 w-32 h-32">
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-x-blue/20 rounded-2xl blur-xl animate-pulse" style={{animationDelay: '0.5s'}}></div>

                            {/* Main scanning frame */}
                            <div className="absolute inset-0 border-3 border-x-blue rounded-2xl bg-x-blue/5 shadow-glow-blue">
                                {/* Label */}
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-x-blue text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide shadow-glow-blue whitespace-nowrap">
                                    QR Code
                                </div>

                                {/* Corner brackets */}
                                <div className="absolute -top-2 -left-2 w-8 h-8 border-t-[4px] border-l-[4px] border-x-blue rounded-tl-lg"></div>
                                <div className="absolute -top-2 -right-2 w-8 h-8 border-t-[4px] border-r-[4px] border-x-blue rounded-tr-lg"></div>
                                <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-[4px] border-l-[4px] border-x-blue rounded-bl-lg"></div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-[4px] border-r-[4px] border-x-blue rounded-br-lg"></div>

                                {/* Center crosshair */}
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4">
                                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-x-blue -translate-y-1/2"></div>
                                    <div className="absolute top-0 left-1/2 w-0.5 h-full bg-x-blue -translate-x-1/2"></div>
                                </div>
                            </div>
                        </div>

                        {/* Status and Instructions Bar - Bottom */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-8">
                            <div className="max-w-3xl mx-auto">
                                {/* Status Indicator */}
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <div className="w-3 h-3 bg-x-green rounded-full animate-pulse shadow-glow-green"></div>
                                    <span className="text-x-green text-xl font-bold uppercase tracking-wider">Scanner Active</span>
                                    <div className="w-3 h-3 bg-x-green rounded-full animate-pulse shadow-glow-green"></div>
                                </div>

                                {/* Instructions Grid */}
                                <div className="grid grid-cols-2 gap-6">
                                    {/* VIN Barcode Instructions */}
                                    <div className="bg-x-bg-secondary/80 backdrop-blur-sm rounded-xl p-4 border border-x-green/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 bg-x-green rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                                                </svg>
                                            </div>
                                            <span className="text-x-green font-bold">VIN Barcode</span>
                                        </div>
                                        <p className="text-x-text text-sm">Align barcode horizontally in green frame</p>
                                        <p className="text-x-text-secondary text-xs mt-1">Hold steady until scan completes</p>
                                    </div>

                                    {/* QR Code Instructions */}
                                    <div className="bg-x-bg-secondary/80 backdrop-blur-sm rounded-xl p-4 border border-x-blue/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 bg-x-blue rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                </svg>
                                            </div>
                                            <span className="text-x-blue font-bold">QR Code</span>
                                        </div>
                                        <p className="text-x-text text-sm">Center QR code in blue square</p>
                                        <p className="text-x-text-secondary text-xs mt-1">Auto-detects when in focus</p>
                                    </div>
                                </div>

                                {/* Tech Info */}
                                <div className="mt-4 text-center">
                                    <p className="text-x-text-secondary text-xs">
                                        <span className="inline-flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                            Multi-format detection • Real-time processing • High accuracy
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
            {error && (
                <div className="p-6 bg-x-red/10 border-t border-x-red/30">
                    <div className="flex items-center gap-3 text-x-red">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">{error}</span>
                    </div>
                </div>
            )}
            {!active && !error && (
                <div className="p-8 bg-x-bg-secondary flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-3 border-x-blue border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-x-text-secondary">Initializing camera system...</span>
                </div>
            )}
        </div>
    );
}
