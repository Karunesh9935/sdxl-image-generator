# ==============================================================================
# Google Colab Script: SDXL Text-To-Image Generator (Gradio Interface)
# Instructions: Copy and paste this complete block into a single code cell 
# inside your Google Colab notebook (ensure you are using a GPU runtime).
# ==============================================================================

import torch
from diffusers import StableDiffusionXLPipeline
import gradio as gr

# 1. Check GPU Availability
gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
if not gpu_name:
    raise RuntimeError(
        "GPU not detected! Please go to: Runtime -> Change runtime type, "
        "and select 'T4 GPU' under hardware accelerators, then run this cell again."
    )
print(f"CUDA GPU detected: {gpu_name}")

# 2. Load the SDXL Base model in float16 precision to fit in T4 VRAM (~15GB)
print("Loading SDXL model checkpoints (this may take 2-4 minutes on first load)...")
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True
)
# Move checkpoints to the GPU VRAM
pipe.to("cuda")

# Apply attention slicing VRAM optimizations for T4 GPU
pipe.enable_attention_slicing()

print("Model pipeline successfully loaded onto GPU!")

# 3. Define synthesis execution block
def generate_image(prompt, negative_prompt, steps, guidance, width, height):
    # Cast parameters to proper types
    steps = int(steps)
    guidance = float(guidance)
    width = int(width)
    height = int(height)
    
    with torch.inference_mode():
        output = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=steps,
            guidance_scale=guidance,
            width=width,
            height=height
        )
    return output.images[0]

# 4. Configure Gradio UI Style
theme = gr.themes.Soft(
    primary_hue="purple",
    secondary_hue="indigo",
    neutral_hue="slate",
)

with gr.Blocks(theme=theme, title="AetherGen SDXL Engine") as demo:
    gr.Markdown("# 🌌 AetherGen SDXL Image Generator")
    gr.Markdown(
        "This interface is running live on a Google Colab GPU. "
        "Share the generated link (`*.gradio.live`) below with others to let them generate images on this backend."
    )
    
    with gr.Row():
        with gr.Column(scale=1):
            prompt = gr.Textbox(
                label="Prompt", 
                placeholder="A stunning cinematic digital art of a celestial dragon flying through a galaxy nebula, 8k resolution, cosmic lighting...",
                lines=4
            )
            neg_prompt = gr.Textbox(
                label="Negative Prompt", 
                placeholder="blurry, low quality, bad anatomy, deformed...",
                value="blurry, low quality, distorted, ugly, bad anatomy, deformed"
            )
            
            with gr.Accordion("Advanced Parameters", open=False):
                steps = gr.Slider(minimum=10, maximum=50, value=30, step=1, label="Inference Steps")
                guidance = gr.Slider(minimum=1.0, maximum=20.0, value=7.5, step=0.5, label="Guidance Scale (CFG)")
                width = gr.Dropdown(choices=[512, 768, 1024], value=1024, label="Width")
                height = gr.Dropdown(choices=[512, 768, 1024], value=1024, label="Height")
                
            generate_btn = gr.Button("🎨 Synthesize Visual", variant="primary")
            
        with gr.Column(scale=1):
            output_image = gr.Image(label="Generated Result", type="pil")

    # Connect button click
    generate_btn.click(
        fn=generate_image,
        inputs=[prompt, neg_prompt, steps, guidance, width, height],
        outputs=output_image
    )

# 5. Launch web server and expose via public tunneling proxy
# The parameter share=True creates a public URL (e.g. https://xxxx.gradio.live)
demo.launch(share=True, debug=True)
