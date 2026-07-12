# ==============================================================================
# Google Colab Script: FastAPI + Ngrok Tunneling for SDXL
# Instructions: Copy and paste this complete block into a single code cell 
# inside your Google Colab notebook (ensure you are using a GPU runtime).
# ==============================================================================

# 1. Install required packages (runs silently)
print("Installing dependencies...")
!pip install -q diffusers transformers accelerate safetensors fastapi uvicorn nest-asyncio pyngrok pydantic

import torch
from diffusers import StableDiffusionXLPipeline
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from io import BytesIO
import uvicorn
import nest_asyncio
from pyngrok import ngrok

# 2. Check GPU Availability
gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
if not gpu_name:
    raise RuntimeError(
        "GPU not detected! Please go to: Runtime -> Change runtime type, "
        "and select 'T4 GPU' under hardware accelerators, then run this cell again."
    )
print(f"CUDA GPU detected: {gpu_name}")

# 3. Load the SDXL Model in float16 precision
print("Loading SDXL model checkpoints onto GPU (this may take 2-4 minutes)...")
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True
)
pipe.to("cuda")
pipe.enable_attention_slicing()  # Apply attention slicing VRAM optimizations
print("Model pipeline successfully loaded onto GPU!")

# 4. Initialize FastAPI app
app = FastAPI(title="SDXL Image Generation API")

# Allow async run inside Colab notebook loop
nest_asyncio.apply()

# Define request body structure
class GenerationRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted, bad anatomy, deformed"
    steps: int = 30
    guidance_scale: float = 7.5
    width: int = 1024
    height: int = 1024

@app.post("/generate")
def generate_image_api(req: GenerationRequest):
    try:
        # Run SDXL model pipeline
        with torch.inference_mode():
            image = pipe(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt,
                num_inference_steps=req.steps,
                guidance_scale=req.guidance_scale,
                width=req.width,
                height=req.height
            ).images[0]
            
        # Save image to bytes buffer
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=90)
        img_bytes = buffer.getvalue()
        
        # Return raw image bytes with image/jpeg mime type
        return Response(content=img_bytes, media_type="image/jpeg")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def home():
    return {"status": "SDXL API is running successfully!"}

# 5. Set up Ngrok tunnel using your token
# Setting your auth token
ngrok.set_auth_token("3GMmCn1lrnkS91bXtsrx4zInGFt_5gjRA5afLVoqmEYP3KC1o")

# Open a tunnel on port 8000 (which FastAPI runs on)
public_url = ngrok.connect(8000)

print("\n" + "="*70)
print("🚀 LIVE PUBLIC API LINK:", public_url)
print("📄 SWAGGER API DOCS:", f"{public_url}/docs")
print("💡 Use the POST endpoint '/generate' with JSON payload to generate images")
print("="*70 + "\n")

# 6. Start FastAPI server
uvicorn.run(app, host="0.0.0.0", port=8000)
