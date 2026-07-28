import React, { useState, useEffect } from 'react';
// Import icons from Lucide-react for professional editorial aesthetics
import { 
  Sparkles,      // Used for logo icon
  Key,           // Used for API key settings button
  Play,          // Used for synthesize button
  Download,      // Used to download generated images
  Copy,          // Used to copy prompt to clipboard
  Info,          // Used for tip cards and notices
  X,             // Close button for settings modal
  Cpu,           // Not directly used but import preserved for library consistency
  Image as ImageIcon, // Used as canvas placeholder icon
  Lock,          // Security icon for API token input
  RefreshCw,     // Spin loader icon
  ExternalLink,  // Hugging Face outbound link icon
  Link           // Link icon for copying real-time live link
} from 'lucide-react';

// Content moderation regex to filter NSFW/Adult/Explicit prompts client-side
const NSFW_PATTERN = /\b(nude|nudity|naked|nsfw|porn|porno|pornography|xxx|erotic|erotica|hentai|sex|sexual|sexuality|breast|breasts|boob|boobs|nipple|nipples|vagina|penis|genitals|genital|undressed|topless|bottomless|strip|stripclub|stripper|playboy|ass|butt|booty|vibrator|orgasm|masturbate|intercourse|copulation|fuck|fucking|dick|pussy|cunt|blowjob|sensual|cleavage|lingerie|underwear|thong|g-string|bikini|fetish|bdsm|lewd|slut|whore|bitch|explicit|adult|unclothed|exposed|lust|seductive|provocative)\b/i;

export default function App() {
  // ==========================================
  // APPLICATION STATE MANAGEMENT
  // ==========================================

  // Prompt states: prompt holds user input; negativePrompt defines elements SDXL & Pollinations should avoid
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('bikini, swimsuit, swimwear, lingerie, underwear, cleavage, revealing clothing, scantily clad, topless, bottomless, nsfw, nude, naked, breasts, nipples, genitals, explicit, adult content, vulgar, erotic, blurry, low quality, distorted, bad anatomy, deformed');
  
  // Guidance scale (Classifier Free Guidance) determines how strictly SDXL adheres to prompt text
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  
  // Model state can be 'flux' or 'sdxl' depending on user choice (defaulting to Flux for high realism)
  const [model, setModel] = useState('flux');
  
  // Aspect ratio presets and numeric resolutions (width and height in pixels)
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  
  // Credentials/Authentication states: token is the active key; tokenInput tracks temporary modal input
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  
  // Output states: imageSrc stores the image URL; realtimeUrl stores the direct live link
  const [imageSrc, setImageSrc] = useState('');
  const [realtimeUrl, setRealtimeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(''); // Text tracking specific stage of generation
  
  // UI states: governs modals and toast notifications
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // ==========================================
  // SIDE EFFECTS & LIFECYCLE
  // ==========================================

  // On initial mount, attempt to load the Hugging Face access token from localStorage.
  useEffect(() => {
    const savedToken = localStorage.getItem('hf_token');
    if (savedToken) {
      setToken(savedToken);
      setTokenInput(savedToken);
    }
  }, []);

  // Helper function to trigger a temporary toast banner at the bottom of the screen.
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ==========================================
  // API TOKEN HANDLERS
  // ==========================================

  const handleSaveToken = () => {
    if (tokenInput.trim()) {
      localStorage.setItem('hf_token', tokenInput.trim());
      setToken(tokenInput.trim());
      setIsTokenModalOpen(false);
      showToast('API token saved to local storage.');
    } else {
      showToast('Please enter a valid token.', 'error');
    }
  };

  const handleClearToken = () => {
    localStorage.removeItem('hf_token');
    setToken('');
    setTokenInput('');
    showToast('API token cleared.', 'info');
  };

  // ==========================================
  // ASPECT RATIO HANDLER
  // ==========================================

  const handleSetAspect = (ratio, w, h) => {
    setAspectRatio(ratio);
    setWidth(w);
    setHeight(h);
    showToast(`Aspect ratio set to ${ratio} (${w}x${h})`, 'info');
  };

  // ==========================================
  // CLIPBOARD COPY UTILITIES
  // ==========================================

  const handleCopyToClipboard = () => {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    showToast('Prompt copied to clipboard!');
  };

  // Copies the direct real-time shareable image link to system clipboard
  const handleCopyRealtimeLink = () => {
    const targetUrl = realtimeUrl || imageSrc;
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl);
    showToast('Real-time image link copied to clipboard!');
  };

  // ==========================================
  // IMAGE SYNTHESIS (MAIN CONTROLLER)
  // Preload image helper to ensure image is 100% loaded into browser memory before removing spinner
  const preloadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('Failed to render generated image asset.'));
      img.src = url;
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Please write a prompt first.', 'error');
      return;
    }

    // Client-side content safety check
    if (NSFW_PATTERN.test(prompt.trim())) {
      showToast('Prompt violates content safety policy (NSFW/Adult/Explicit content is restricted).', 'error');
      return;
    }

    setIsLoading(true);
    setLoadingStage('Initializing real-time link generator...');
    setImageSrc('');
    setRealtimeUrl('');

    const stages = [
      { msg: 'Contacting real-time synthesis engine...', delay: 1500 },
      { msg: 'Encoding prompt latents & computing seed...', delay: 3500 },
      { msg: 'Rendering high-resolution pixels...', delay: 6000 }
    ];

    const timers = stages.map(stage => 
      setTimeout(() => setLoadingStage(stage.msg), stage.delay)
    );

    try {
      let response;

      // ATTEMPT 1: Request Serverless Proxy Backend (/api/generate)
      try {
        const payload = {
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim(),
          guidance_scale: Number(guidanceScale),
          width: Number(width),
          height: Number(height),
          model: model,
          return_url: true
        };

        response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (proxyError) {
        console.warn('Backend proxy unreachable, switching to direct real-time generator...', proxyError);
      }

      // Handle backend safety rejection (HTTP 400 Bad Request)
      if (response && response.status === 400) {
        const errData = await response.json().catch(() => ({}));
        showToast(errData.detail || 'Prompt violates content safety policy.', 'error');
        return;
      }

      // Check if backend proxy returned a valid response
      let finalSrc = '';
      let finalLiveLink = '';

      if (response && response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          finalSrc = data.image || data.url;
          finalLiveLink = data.url || finalSrc;
        } else if (contentType.includes('image/')) {
          const blob = await response.blob();
          finalSrc = URL.createObjectURL(blob);
          finalLiveLink = finalSrc;
        }
      }

      // ATTEMPT 2: Direct High-Speed Real-Time Generation (if proxy unavailable or returned non-JSON/HTML)
      if (!finalSrc) {
        if (NSFW_PATTERN.test(prompt.trim())) {
          showToast('Prompt violates content safety policy.', 'error');
          return;
        }

        const pollModel = model === 'flux' ? 'flux' : 'sdxl';
        const seed = Math.floor(Math.random() * 900000) + 10000;
        
        let formattedPrompt = prompt.trim();
        const isPeoplePrompt = /\b(girl|woman|female|lady|portrait|person|model|man|guy|boy)\b/i.test(formattedPrompt);
        const hasClothingSpec = /\b(dress|shirt|jacket|coat|sweater|suit|hoodie|jeans|clothes|clothing|attire|outfit|saree|kurti|t-shirt)\b/i.test(formattedPrompt);
        
        if (isPeoplePrompt && !hasClothingSpec) {
          formattedPrompt = `${formattedPrompt}, modestly dressed in elegant casual attire`;
        }

        const combinedAvoid = negativePrompt.trim() 
          ? negativePrompt.trim() 
          : 'bikini, swimsuit, swimwear, lingerie, underwear, cleavage, revealing clothing, scantily clad, topless, bottomless, nude, nsfw';

        const promptText = `${formattedPrompt} [avoid: ${combinedAvoid}]`;
        finalLiveLink = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=${width}&height=${height}&model=${pollModel}&nologo=true&seed=${seed}`;
        
        try {
          const imgResp = await fetch(finalLiveLink);
          if (imgResp.ok) {
            const blob = await imgResp.blob();
            finalSrc = URL.createObjectURL(blob);
          } else {
            finalSrc = finalLiveLink;
          }
        } catch (fetchErr) {
          console.warn('Direct fetch error, falling back to live link URL:', fetchErr);
          finalSrc = finalLiveLink;
        }
      }

      // Preload the image asset so it renders instantly without flicker or broken box
      await preloadImage(finalSrc);

      setImageSrc(finalSrc);
      setRealtimeUrl(finalLiveLink);
      showToast('Real-time image generated successfully!');

    } catch (err) {
      console.error(err);
      showToast(err.message || 'Generation failed. Please try again.', 'error');
    } finally {
      timers.forEach(clearTimeout);
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // ==========================================
  // DOM / UI RENDER TREE
  // ==========================================
  return (
    <div className="min-h-screen bg-warmwhite-100 flex flex-col justify-between font-sans selection:bg-stone-200 selection:text-slate-900 antialiased">
      
      {/* 1. Header Navigation Bar */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          
          {/* Logo & Brand Meta */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-stone-900 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold tracking-tight text-stone-900">AetherGen</h1>
              <span className="text-[10px] block text-stone-500 uppercase tracking-wider font-semibold font-mono">Synthesizer Engine</span>
            </div>
          </div>
          
          {/* Navigation Actions (Settings Modal and External Documentation Link) */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsTokenModalOpen(true)}
              className="px-3.5 py-1.5 border border-stone-200 hover:border-stone-400 bg-white rounded text-stone-700 hover:text-stone-950 transition duration-150 flex items-center gap-2 text-xs font-medium shadow-sm"
            >
              <Key className="w-3.5 h-3.5 text-stone-500" />
              <span>API Key</span>
              {/* Green indicator displays if a token is active/loaded */}
              {token && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
            </button>
            <a 
              href="https://huggingface.co" 
              target="_blank" 
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition"
            >
              Hugging Face
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace Layout Grid */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Parameter controls and prompts configuration */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-stone-200 rounded-lg p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            
            {/* Component Title Card */}
            <div>
              <h2 className="font-serif font-bold text-xl text-stone-900">Model Parameters</h2>
              <p className="text-xs text-stone-500 mt-1">Select your synthesis engine and customize generation properties.</p>
            </div>

            {/* Model Selector Cards (Flux vs Stable Diffusion) */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Generation Model</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Flux.1 Option Button */}
                <button 
                  onClick={() => setModel('flux')}
                  className={`p-4 rounded border text-left flex flex-col justify-between transition-all duration-200 ${
                    model === 'flux' 
                      ? 'border-stone-950 bg-stone-50/50 ring-1 ring-stone-950' 
                      : 'border-stone-200 hover:border-stone-400 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-serif font-bold text-stone-900 text-sm">Flux.1 Schnell</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase ${
                      model === 'flux' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>Realistic</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-3 leading-relaxed">
                    Extreme photorealism, perfect fingers/eyes, renders clear text. Optimized 4-step generation.
                  </p>
                </button>

                {/* SDXL Option Button */}
                <button 
                  onClick={() => setModel('sdxl')}
                  className={`p-4 rounded border text-left flex flex-col justify-between transition-all duration-200 ${
                    model === 'sdxl' 
                      ? 'border-stone-950 bg-stone-50/50 ring-1 ring-stone-950' 
                      : 'border-stone-200 hover:border-stone-400 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-serif font-bold text-stone-900 text-sm">SDXL Base 1.0</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase ${
                      model === 'sdxl' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>Standard</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-3 leading-relaxed">
                    Classic SDXL engine. Highly adjustable using negative prompts and CFG scale sliders.
                  </p>
                </button>

              </div>
            </div>

            {/* Prompt Input Textarea */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label htmlFor="creative-prompt" className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Creative Prompt</label>
                <span className="text-[10px] text-stone-400 font-mono">{prompt.length}/500</span>
              </div>
              <textarea 
                id="creative-prompt"
                rows="4" 
                maxLength="500"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  model === 'flux' 
                    ? "A realistic photo of an old traveler in a cozy wooden cabin, warm lighting from a fireplace, shot on 35mm film lens, detailed face textures..." 
                    : "A photorealistic portrait of an old traveler inside a wooden cabin, warm lighting, highly detailed skin texture, 8k resolution..."
                }
                className="w-full p-3.5 rounded border border-stone-200 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-950 focus:ring-1 focus:ring-stone-950 transition text-sm resize-none"
              />
            </div>

            {/* Dynamic settings container (changes based on selected engine) */}
            <div className="border-t border-stone-100 pt-4 flex flex-col gap-4">
              
              {model === 'flux' ? (
                // Helpful information alert box for Flux settings
                <div className="p-3 bg-stone-50 border border-stone-200/60 rounded flex gap-2.5 items-start">
                  <Info className="w-4 h-4 text-stone-500 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] text-stone-600 leading-relaxed">
                    <span className="font-semibold text-stone-800">Parameters Optimised: </span>
                    Flux.1 Schnell runs in 4 fast steps. Negative prompting and CFG scale are automatically bypassed for maximum realism and speed.
                  </div>
                </div>
              ) : (
                // Custom input parameters for SDXL model (Negative Prompt & Guidance Slider)
                <>
                  {/* Negative prompt configuration */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="negative-prompt" className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Negative Prompt</label>
                    <input 
                      id="negative-prompt"
                      type="text" 
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-stone-200 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-950 focus:ring-1 focus:ring-stone-950 transition text-sm"
                    />
                  </div>

                  {/* CFG Guidance slider */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <label htmlFor="cfg-scale" className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Guidance Scale (CFG)</label>
                      <span className="font-mono text-xs font-semibold text-stone-700">{guidanceScale}</span>
                    </div>
                    <input 
                      id="cfg-scale"
                      type="range" 
                      min="1" 
                      max="20" 
                      step="0.5" 
                      value={guidanceScale}
                      onChange={(e) => setGuidanceScale(Number(e.target.value))}
                      className="w-full accent-stone-850 h-1 bg-stone-100 rounded appearance-none cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Dimensions Presets Buttons */}
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Dimensions & Aspect Ratio</span>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => handleSetAspect('1:1', 1024, 1024)} 
                    className={`px-3 py-2 rounded text-xs font-medium border transition-all duration-150 ${
                      aspectRatio === '1:1' 
                        ? 'border-stone-950 bg-stone-50 text-stone-950 font-bold' 
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                    }`}
                  >
                    1:1 Square
                  </button>
                  <button 
                    onClick={() => handleSetAspect('4:3', 1024, 768)} 
                    className={`px-3 py-2 rounded text-xs font-medium border transition-all duration-150 ${
                      aspectRatio === '4:3' 
                        ? 'border-stone-950 bg-stone-50 text-stone-950 font-bold' 
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                    }`}
                  >
                    4:3 Landscape
                  </button>
                  <button 
                    onClick={() => handleSetAspect('3:4', 768, 1024)} 
                    className={`px-3 py-2 rounded text-xs font-medium border transition-all duration-150 ${
                      aspectRatio === '3:4' 
                        ? 'border-stone-950 bg-stone-50 text-stone-950 font-bold' 
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                    }`}
                  >
                    3:4 Portrait
                  </button>
                </div>
              </div>

            </div>

            {/* Synthesize Submit Button */}
            <button 
              onClick={handleGenerate}
              disabled={isLoading}
              className={`button-editorial mt-2 w-full py-3.5 rounded bg-stone-900 text-white font-medium flex items-center justify-center gap-2 hover:bg-stone-800 focus:outline-none transition active:scale-[0.99] shadow ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white text-white" />
              )}
              <span>{isLoading ? 'Synthesizing...' : 'Synthesize Image'}</span>
            </button>
          </div>

          {/* Editorial prompt recommendation tip box */}
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-5 flex gap-3 text-xs text-stone-600">
            <Info className="w-4.5 h-4.5 text-stone-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-stone-850 block mb-0.5">Prompt Tip for Realism:</span>
              <p className="leading-relaxed">To get best results, describe lighting (e.g. "morning fog", "golden hour") and camera optics (e.g. "candid snapshot", "grainy 35mm film") rather than words like "photorealistic".</p>
            </div>
          </div>
        </section>

        {/* Right Column: Visualization Canvas representing the generated outcome */}
        <section className="lg:col-span-7 flex flex-col h-full min-h-[500px]">
          <div className="bg-white border border-stone-200 rounded-lg p-6 flex-grow flex flex-col justify-center items-center relative shadow-sm h-full overflow-hidden">
            
            {/* Visual Canvas State A: Idle State (No image, not loading) */}
            {!isLoading && !imageSrc && (
              <div className="flex flex-col items-center justify-center text-center p-8 gap-4 max-w-sm">
                <div className="w-12 h-12 rounded bg-stone-50 flex items-center justify-center border border-stone-200">
                  <ImageIcon className="w-5 h-5 text-stone-500" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">Visualization Canvas</h3>
                  <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                    Your generated image will appear here. Set model configurations on the left and synthesize your asset.
                  </p>
                </div>
              </div>
            )}

            {/* Visual Canvas State B: Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center text-center p-8 gap-6 z-10 animate-fade-in">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-stone-200 animate-pulse"></div>
                  <div className="absolute inset-0 rounded-full border-t-2 border-stone-900 animate-spin"></div>
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">Synthesizing Visuals</h3>
                  <p className="text-xs text-stone-500 mt-2 min-h-[1.5rem]" id="loading-stage">
                    {loadingStage}
                  </p>
                </div>
              </div>
            )}

            {/* Visual Canvas State C: Result State (Displays generated image and controls) */}
            {!isLoading && imageSrc && (
              <div className="w-full h-full flex flex-col gap-4 z-10 relative">
                {/* Image display container */}
                <div className="relative rounded bg-stone-50 border border-stone-200 group flex items-center justify-center overflow-hidden flex-grow max-h-[580px]">
                  <img 
                    src={imageSrc} 
                    alt="Synthesized visual asset" 
                    className="max-h-[500px] w-auto object-contain select-none shadow"
                  />
                  
                  {/* Floating Action Buttons (visible on hover) */}
                  <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-sm p-1.5 rounded border border-stone-250/50 shadow-md">
                    {/* Copy Real-Time Link Button */}
                    <button 
                      onClick={handleCopyRealtimeLink}
                      className="p-2 hover:bg-stone-100 rounded text-stone-700 hover:text-stone-900 transition flex items-center justify-center"
                      title="Copy Real-Time Live Link"
                    >
                      <Link className="w-4 h-4 text-emerald-600" />
                    </button>
                    {/* Download Image Button */}
                    <a 
                      href={imageSrc} 
                      download={`aethergen_${model}_${width}x${height}.jpg`}
                      className="p-2 hover:bg-stone-100 rounded text-stone-700 hover:text-stone-900 transition flex items-center justify-center"
                      title="Download image"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {/* Copy Prompt Button */}
                    <button 
                      onClick={handleCopyToClipboard}
                      className="p-2 hover:bg-stone-100 rounded text-stone-700 hover:text-stone-900 transition flex items-center justify-center"
                      title="Copy prompt"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Metadata specs of generated image */}
                <div className="flex justify-between items-center border-t border-stone-100 pt-4 px-1 text-xs">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Dimensions</span>
                    <p className="text-xs font-semibold text-stone-800 mt-0.5">{width} x {height} ({aspectRatio})</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Engine</span>
                    <p className="text-xs font-semibold text-stone-850 mt-0.5">
                      {model === 'flux' ? 'Flux.1 Schnell (4 Steps)' : 'SDXL Base (1.0)'}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>

      </main>

      {/* 3. Settings Modal Overlay (API Key Configuration) */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 transition duration-200">
          <div className="bg-white max-w-md w-full mx-4 rounded-lg p-6 md:p-8 shadow-2xl relative border border-stone-200">
            {/* Close Modal Button */}
            <button 
              onClick={() => setIsTokenModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition"
            >
              <X className="w-4 h-4" />
            </button>
            
            {/* Modal Title Banner */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded bg-stone-50 flex items-center justify-center text-stone-700 border border-stone-200">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-base">API Authentication</h3>
                <p className="text-xs text-stone-500">Configure your local API Credentials</p>
              </div>
            </div>
            
            {/* Modal Input Form */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="token-input" className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">Hugging Face Read Token</label>
                <input 
                  id="token-input"
                  type="password" 
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="hf_..." 
                  className="w-full px-3 py-2.5 rounded border border-stone-200 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-950 focus:ring-1 focus:ring-stone-950 transition text-sm"
                />
                <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                  This token is stored safely in your browser storage. It is only used if the server does not have a configured environment variable, or when calling Hugging Face directly. You can create a token in your Hugging Face settings under Access Tokens.
                </p>
              </div>
              
              {/* Form Action Controls */}
              <div className="flex gap-3 mt-4 text-xs font-medium">
                <button 
                  onClick={handleSaveToken}
                  className="flex-grow py-2.5 px-4 rounded bg-stone-900 text-white hover:bg-stone-850 transition"
                >
                  Save Stored
                </button>
                <button 
                  onClick={handleClearToken}
                  className="py-2.5 px-4 rounded bg-white border border-stone-200 hover:border-stone-400 text-stone-600 hover:text-stone-800 transition"
                >
                  Clear Stored
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Toast Notifications Notification Panel */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded bg-stone-900 text-white shadow-xl text-xs z-50 flex items-center gap-2.5 border border-stone-800 transition duration-300">
          <span className={`w-1.5 h-1.5 rounded-full ${
            toast.type === 'error' ? 'bg-rose-500' : toast.type === 'info' ? 'bg-amber-400' : 'bg-emerald-500'
          }`}></span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* 5. Page Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-stone-200 mt-12 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase font-mono tracking-wider text-stone-400">
        <div>
          &copy; 2026 AetherGen Synthesis Interface. All Rights Reserved.
        </div>
        <div className="flex gap-4">
          <a href="https://huggingface.co/black-forest-labs/FLUX.1-schnell" target="_blank" rel="noreferrer" className="hover:text-stone-600 transition">Flux.1</a>
          <span>&bull;</span>
          <a href="https://stability.ai/" target="_blank" rel="noreferrer" className="hover:text-stone-600 transition">Stability AI</a>
          <span>&bull;</span>
          <span className="text-stone-500 font-semibold">Dual Engine Platform</span>
        </div>
      </footer>

    </div>
  );
}
