<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/fff1529b-a142-4f56-874c-3e0d42b99c47

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Credits

- 3D hand model: ["Low Poly Right Hand"](https://poly.pizza/m/cl8ax5B13cp) by **Raziq Brown**, licensed under [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/), via [Poly Pizza](https://poly.pizza/). Bundled at `public/models/hand.glb`; recolored to a skin tone at runtime.
