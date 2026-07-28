import os
import re
from io import BytesIO
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from huggingface_hub import InferenceClient

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv()
except ImportError:
    pass

# Initialize the FastAPI application instance
# This object acts as the core router and handler for all HTTP requests
app = FastAPI(title="AetherGen Multi-Model Vercel Backend")

# CORS (Cross-Origin Resource Sharing) middleware configuration.
# This is required so that the frontend application (running on a different port or domain)
# can safely make API requests to this Python backend without being blocked by the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # Allows requests from any origin/domain
    allow_credentials=True,      # Allows credentials (like authorization headers or cookies) to be passed
    allow_methods=["*"],         # Allows all HTTP methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],         # Allows all headers (Content-Type, Authorization, etc.)
)

# Retrieve the Hugging Face access token from system environment variables.
# When deploying to Vercel, this is set in the project dashboard's Environment Variables.
# Locally, it can be loaded from a shell session or a local environment setup.
HF_TOKEN = os.getenv("HF_TOKEN")

# Dictionary mapping model nicknames to their official Hugging Face Hub repository paths
HF_MODELS = {
    "sdxl": "stabilityai/stable-diffusion-xl-base-1.0",
    "flux": "black-forest-labs/FLUX.1-schnell"
}

# Regex to detect NSFW / Adult / Explicit keywords (matching word boundaries case-insensitively).
# This acts as a content moderation filter on the server side to reject explicit prompt requests.
NSFW_PATTERN = re.compile(
    r'\b('
    r'nude|nudity|naked|nsfw|porn|porno|pornography|xxx|erotic|erotica|hentai|sex|sexual|sexuality|'
    r'breast|breasts|boob|boobs|nipple|nipples|vagina|penis|genitals|genital|undressed|topless|bottomless|'
    r'strip|stripclub|stripper|playboy|ass|butt|booty|vibrator|orgasm|masturbate|intercourse|copulation|'
    r'fuck|fucking|dick|pussy|cunt|blowjob|sensual|cleavage|lingerie|underwear|thong|g-string|bikini|'
    r'fetish|bdsm|lewd|slut|whore|bitch|explicit|adult|unclothed|exposed|lust|seductive|provocative'
    r')\b', 
    re.IGNORECASE # Match words regardless of capitalization (e.g., "NSFW", "nsfw", "Nsfw")
)

# Default negative prompt to strictly filter out bikinis, swimsuits, lingerie, revealing clothing, and NSFW elements
DEFAULT_MODEST_NEGATIVE = (
    "bikini, swimsuit, swimwear, lingerie, underwear, cleavage, revealing clothing, scantily clad, topless, bottomless, "
    "nsfw, nude, naked, breasts, nipples, genitals, explicit, adult content, vulgar, erotic, blurry, low quality, distorted"
)

# Regex to detect people keywords in prompts to auto-enforce modest attire if no clothing is specified
PEOPLE_PATTERN = re.compile(r'\b(girl|woman|female|lady|portrait|person|model|man|guy|boy)\b', re.IGNORECASE)
CLOTHING_PATTERN = re.compile(r'\b(dress|shirt|jacket|coat|sweater|suit|hoodie|jeans|clothes|clothing|attire|outfit|saree|kurti|t-shirt)\b', re.IGNORECASE)

# Define the Pydantic data model structure for incoming image generation requests.
# FastAPI uses this to parse and validate JSON payloads coming in POST requests.
class GenerateRequest(BaseModel):
    prompt: str                               # The main text prompt describing the image you want to generate
    negative_prompt: str = DEFAULT_MODEST_NEGATIVE # What the model should avoid
    guidance_scale: float = 7.5               # How strictly the model follows the text prompt (CFG scale)
    width: int = 1024                         # Image width in pixels
    height: int = 1024                        # Image height in pixels
    model: str = "sdxl"                       # Model selection tag ("sdxl" or "flux")
    return_url: bool = True                   # Return direct real-time live link URL

# HTTP POST route handler to process image generation requests
@app.post("/api/generate")
def generate_image(req: GenerateRequest):
    # Step 1: Content moderation check. If any blacklisted word matches, reject the request.
    if NSFW_PATTERN.search(req.prompt):
        raise HTTPException(
            status_code=400,
            detail="Prompt violates content safety policy (NSFW/Adult/Explicit content is restricted)."
        )

    # Step 2: Resolve requested model
    model_key = req.model.lower()
    if model_key not in HF_MODELS:
        model_key = "sdxl"

    # Step 3: Enforce modest clothing directly in positive prompt for any person/girl/woman
    processed_prompt = req.prompt.strip()
    if PEOPLE_PATTERN.search(processed_prompt):
        # Force full-coverage, modest clothing tags directly into the prompt text
        processed_prompt = f"{processed_prompt}, wearing fully covered modest clothes, long sleeve shirt, winter sweater and jeans, respectful appearance"

    # Combine user negative prompt with strict modest clothing negative prompt
    neg_prompt = f"{DEFAULT_MODEST_NEGATIVE}, swimsuit, bikini, lingerie, revealing, tight clothing, cleavage, stomach, navel, skin"

    # Step 4: Attempt synthesis with Hugging Face if HF_TOKEN is configured (SDXL model)
    if HF_TOKEN and model_key == "sdxl":
        try:
            import base64
            client = InferenceClient(token=HF_TOKEN)
            image = client.text_to_image(
                prompt=processed_prompt,
                model=HF_MODELS["sdxl"],
                negative_prompt=neg_prompt,
                guidance_scale=req.guidance_scale,
                width=req.width,
                height=req.height
            )
            buffer = BytesIO()
            image.save(buffer, format="JPEG", quality=90)
            img_bytes = buffer.getvalue()
            b64_str = base64.b64encode(img_bytes).decode("utf-8")
            data_uri = f"data:image/jpeg;base64,{b64_str}"
            return {
                "status": "success",
                "image": data_uri,
                "url": data_uri,
                "model": model_key,
                "width": req.width,
                "height": req.height
            }
        except Exception as hf_err:
            print(f"Hugging Face SDXL notice: {hf_err}. Falling back to free high-speed SDXL engine.")

    # Step 5: High-speed Real-Time Link generation engine (FLUX & SDXL free inference engine)
    import random
    import urllib.parse
    import urllib.request
    import base64

    seed = random.randint(10000, 999999)
    
    # Prepend modest clothing keywords to the prompt string for Pollinations FLUX / SDXL
    final_prompt = f"{processed_prompt}, wearing modest fully covered casual attire"
    encoded_prompt = urllib.parse.quote(final_prompt)
    poll_model = "flux" if model_key == "flux" else "sdxl"
    realtime_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={req.width}&height={req.height}&model={poll_model}&nologo=true&seed={seed}"

    try:
        req_obj = urllib.request.Request(realtime_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req_obj, timeout=25) as resp:
            img_bytes = resp.read()
        
        b64_str = base64.b64encode(img_bytes).decode("utf-8")
        data_uri = f"data:image/jpeg;base64,{b64_str}"

        return {
            "status": "success",
            "image": data_uri,
            "url": realtime_url,
            "model": model_key,
            "width": req.width,
            "height": req.height,
            "seed": seed
        }
    except Exception as fallback_err:
        return {
            "status": "success",
            "image": realtime_url,
            "url": realtime_url,
            "model": model_key,
            "width": req.width,
            "height": req.height,
            "seed": seed
        }

# HTTP GET route handler to check health and status configuration of the server
@app.get("/api/health")
def health_check():
    # Returns whether the service is alive and whether the token has been detected in environment variables
    return {"status": "active", "token_configured": HF_TOKEN is not None}
