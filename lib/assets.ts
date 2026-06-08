import { productImageUrl } from "@/lib/supabase";

/** Storage path in bucket `product-images` (must match Supabase upload). */
export const LOGO_STORAGE_PATH = "DPT ONE LOGO/dpt-one-logo.png";

export const LOGO_URL = productImageUrl(LOGO_STORAGE_PATH);

export const WELCOME_MODAL_IMAGE_URL = productImageUrl(
  "product-images/Welcome Modal Image/welcomeModalImage.png"
);

/** Slider images live under the nested `product-images/` folder in the bucket. */
const SLIDER_PREFIX = "product-images/Image Sliders";

export const HERO_SLIDER_IMAGES = [
  {
    id: 1,
    image: productImageUrl(`${SLIDER_PREFIX}/CharlotteFolk.png`),
    title: "Charlotte Folk",
    subtitle: "Fresh streetwear for the bold.",
  },
  {
    id: 2,
    image: productImageUrl(`${SLIDER_PREFIX}/MNLA.png`),
    title: "MNLA",
    subtitle: "Urban vibes, modern style.",
  },
  {
    id: 3,
    image: productImageUrl(`${SLIDER_PREFIX}/RichBoyz.png`),
    title: "Rich Boyz",
    subtitle: "Elevate your look.",
  },
  {
    id: 4,
    image: productImageUrl(`${SLIDER_PREFIX}/Strap.png`),
    title: "Strap",
    subtitle: "Strap in for style.",
  },
] as const;
