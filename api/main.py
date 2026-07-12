import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="AetherGen SDXL Vercel Backend")

# Enable CORS so your frontend can call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hugging Face Configuration
# Configure HF_TOKEN in your Vercel Dashboard Environment Variables
HF_TOKEN = os.getenv("HF_TOKEN")
HF_MODEL_API = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted"
    guidance_scale: float = 7.5

@app.post("/api/generate")
def generate_image(req: GenerateRequest):
    if not HF_TOKEN:
        raise HTTPException(
            status_code=500, 
            detail="Hugging Face Access Token (HF_TOKEN) is not configured in the environment variables."
        )

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": req.prompt,
        "parameters": {
            "negative_prompt": req.negative_prompt,
            "guidance_scale": req.guidance_scale
        }
    }
    
    import time
    
    last_error = None
    for attempt in range(3):
        try:
            response = requests.post(HF_MODEL_API, headers=headers, json=payload, timeout=60)
            
            # Check if Hugging Face returns an error (e.g. model warming up 503)
            if response.status_code != 200:
                try:
                    error_info = response.json()
                    error_msg = error_info.get("error", "Failed to generate image from Hugging Face API.")
                except Exception:
                    error_msg = f"Hugging Face returned status {response.status_code}"
                
                # If model is warming up (503), wait and retry
                if response.status_code == 503 and attempt < 2:
                    time.sleep(3)
                    continue
                    
                raise HTTPException(status_code=response.status_code, detail=error_msg)
                
            return Response(content=response.content, media_type="image/jpeg")
            
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            last_error = e
            if attempt < 2:
                time.sleep(2)  # Wait 2 seconds before retrying
                continue
            
    # If all 3 attempts failed due to network errors
    raise HTTPException(
        status_code=502, 
        detail=f"Hugging Face is temporarily unreachable from Vercel: {str(last_error)}"
    )

@app.get("/api/health")
def health_check():
    return {"status": "active", "token_configured": HF_TOKEN is not None}
