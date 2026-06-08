"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAdminProduct } from "@/lib/admin/products";
import {
  listBrandProductImages,
  uploadCroppedProductImage,
} from "@/lib/admin/product-images";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Modal from 'react-modal';


export default function AddProductPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [brand, setBrand] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [sizes, setSizes] = useState([{ size: '', stock: '' }]);
  const [color, setColor] = useState("");
  const brandOptions = ["Strap", "Richboyz", "Charlotte Folk", "MN+LA"];
  const router = useRouter();
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropConfig, setCropConfig] = useState<Crop>({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const [cropImageRef, setCropImageRef] = useState<HTMLImageElement | null>(null);
  const [croppingIdx, setCroppingIdx] = useState<number | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [addedProductName, setAddedProductName] = useState("");
  const [imageListError, setImageListError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchImages = async () => {
      setLoadingImages(true);
      setImageListError(null);
      if (!brand) {
        setImages([]);
        setLoadingImages(false);
        return;
      }
      try {
        const urls = await listBrandProductImages(brand);
        if (!cancelled) setImages(urls);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setImages([]);
          setImageListError("Could not load images for this brand.");
        }
      } finally {
        if (!cancelled) setLoadingImages(false);
      }
    };
    void fetchImages();
    return () => {
      cancelled = true;
    };
  }, [brand]);

  const addSelectedImage = (url: string) => {
    setSelectedImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setStock("");
    setColor("");
    setSelectedImages([]);
    setBrand("");
    setIsFeatured(false);
    setSizes([{ size: "", stock: "" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const filteredSizes = sizes
        .filter((s) => s.size && s.stock !== "")
        .map((s) => ({ size: s.size, stock: Number(s.stock) }));
      await createAdminProduct({
        name,
        description,
        price: Number(price),
        color,
        imageUrls: selectedImages.filter(Boolean),
        brand: brand || undefined,
        isFeaturedProduct: isFeatured,
        sizes: filteredSizes,
      });
      setAddedProductName(name);
      resetForm();
      setSuccessModalOpen(true);
    } catch (error) {
      alert("Failed to add product. Please try again.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get cropped image as blob using react-image-crop
  async function getCroppedImg(image: HTMLImageElement, crop: Crop) {
    if (!crop.width || !crop.height) return null;

    let cropX: number;
    let cropY: number;
    let cropWidth: number;
    let cropHeight: number;

    if (crop.unit === "%") {
      cropX = Math.round((crop.x / 100) * image.naturalWidth);
      cropY = Math.round((crop.y / 100) * image.naturalHeight);
      cropWidth = Math.round((crop.width / 100) * image.naturalWidth);
      cropHeight = Math.round((crop.height / 100) * image.naturalHeight);
    } else {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      cropX = Math.round(crop.x * scaleX);
      cropY = Math.round(crop.y * scaleY);
      cropWidth = Math.round(crop.width * scaleX);
      cropHeight = Math.round(crop.height * scaleY);
    }
    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );
    return new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          resolve(url);
        } else {
          resolve('');
        }
      }, 'image/jpeg');
    });
  }

  const handleImageClick = (url: string, idx: number) => {
    setCropImage(url);
    setCroppingIdx(idx);
    const fullCrop: Crop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };
    setCropConfig(fullCrop);
    setCompletedCrop(fullCrop);
    setCropModalOpen(true);
  };

  const handleCropComplete = async () => {
    if (!cropImage || croppingIdx === null || !brand || !completedCrop) {
      setCropModalOpen(false);
      return;
    }

    const isFullImage =
      completedCrop.unit === "%" &&
      completedCrop.x === 0 &&
      completedCrop.y === 0 &&
      Math.round(completedCrop.width) >= 99 &&
      Math.round(completedCrop.height) >= 99;

    try {
      if (isFullImage) {
        addSelectedImage(cropImage);
        setCroppedImageUrl(cropImage);
      } else {
        if (!cropImageRef) {
          alert("Image is still loading. Please wait a moment and try again.");
          return;
        }
        const croppedUrl = await getCroppedImg(cropImageRef, completedCrop);
        if (!croppedUrl) {
          alert("Could not crop image. Please try again.");
          return;
        }
        const response = await fetch(croppedUrl);
        const blob = await response.blob();
        const fileName =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? `cropped_${crypto.randomUUID()}.jpg`
            : `cropped_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        const publicUrl = await uploadCroppedProductImage(brand, blob, fileName);
        addSelectedImage(publicUrl);
        setCroppedImageUrl(publicUrl);
      }
    } catch (err) {
      console.error(err);
      alert(
        "Image upload failed. " +
          (err instanceof Error ? err.message : "Please try again.")
      );
      return;
    }

    setCropModalOpen(false);
    setCropImage(null);
    setCroppingIdx(null);
    setCropImageRef(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-8">
        <h2 className="text-2xl font-bold mb-6 text-center text-[#3390ff]">Add New Product</h2>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8ec0ff] mb-1">Product Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-[#22304a] border border-[#22304a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#3390ff] text-white placeholder-[#8ec0ff]"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8ec0ff] mb-1">Description</label>
            <textarea
              className="w-full px-4 py-2 bg-[#22304a] border border-[#22304a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#3390ff] text-white placeholder-[#8ec0ff]"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8ec0ff] mb-1">Price (₱)</label>
            <input
              type="number"
              className="w-full px-4 py-2 bg-[#22304a] border border-[#22304a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#3390ff] text-white placeholder-[#8ec0ff]"
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8ec0ff] mb-1">Sizes & Stock</label>
            {sizes.map((s, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select
                  className="w-1/2 px-3 py-2 bg-[#22304a] border border-[#22304a] rounded-md text-white placeholder-[#8ec0ff]"
                  value={s.size}
                  onChange={e => {
                    const newSizes = [...sizes];
                    newSizes[idx].size = e.target.value;
                    setSizes(newSizes);
                  }}
                  required
                >
                  <option value="">Select size</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="2XL">2XL</option>
                </select>
                <input
                  type="number"
                  placeholder="Stock"
                  className="w-1/2 px-3 py-2 bg-[#22304a] border border-[#22304a] rounded-md text-white placeholder-[#8ec0ff]"
                  value={s.stock}
                  onChange={e => {
                    const newSizes = [...sizes];
                    newSizes[idx].stock = e.target.value;
                    setSizes(newSizes);
                  }}
                />
                {sizes.length > 1 && (
                  <button type="button" onClick={() => setSizes(sizes.filter((_, i) => i !== idx))} className="text-red-400 font-bold px-2">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setSizes([...sizes, { size: '', stock: '' }])} className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold">+ Add Size</button>
          </div>
          <div className="mb-4">
            <label htmlFor="color" className="block text-[#60A5FA] font-medium mb-2">Color</label>
            <input
              id="color"
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-[#101828] text-[#60A5FA] border border-[#22304a] focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
              placeholder="Enter product color (e.g. Black, Red)"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8ec0ff] mb-1">Brand</label>
            <select
              className="w-full px-4 py-2 bg-[#22304a] border border-[#22304a] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#3390ff]"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              required
            >
              <option value="">Select a brand</option>
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8ec0ff] mb-1">Select Product Images</label>
            <p className="text-xs text-[#8ec0ff] mb-2">
              {brand
                ? "Click an image to select it, or use Crop to adjust before selecting."
                : "Select a brand first to load images."}
            </p>
            {loadingImages ? (
              <div className="text-[#8ec0ff] text-sm">Loading images...</div>
            ) : imageListError ? (
              <div className="text-red-400 text-sm">{imageListError}</div>
            ) : !brand ? (
              <div className="text-[#8ec0ff] text-sm">Select a brand to view images.</div>
            ) : images.length === 0 ? (
              <div className="text-[#8ec0ff] text-sm">
                No images found for this brand in storage.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto">
                {images.map((img, idx) => (
                  <div key={img} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => addSelectedImage(img)}
                      className={`p-0.5 rounded-md border-2 transition-colors ${
                        selectedImages.includes(img)
                          ? "border-[#3390ff] ring-2 ring-[#3390ff]/40"
                          : "border-[#22304a] hover:border-[#3390ff]"
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Product ${idx + 1}`}
                        className="w-20 h-20 object-contain rounded bg-white"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImageClick(img, idx)}
                      className="text-xs text-[#8ec0ff] hover:text-[#3390ff] underline"
                    >
                      Crop
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedImages.length > 0 && (
            <div className="mt-4 border border-[#3390ff]/40 rounded-md p-3 bg-[#22304a]">
              <div className="text-xs font-semibold text-[#3390ff] mb-2">Images Selected ({selectedImages.length})</div>
              <div className="flex gap-2 overflow-x-auto">
                {selectedImages.map((img, i) => (
                  <div key={i} className="relative inline-block">
                    <img src={img} alt="Selected" className="w-16 h-16 object-contain rounded border border-[#3390ff] bg-white" />
                    <button
                      type="button"
                      onClick={() => setSelectedImages(selectedImages.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700 shadow"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={e => setIsFeatured(e.target.checked)}
              className="accent-[#3390ff] w-4 h-4"
            />
            <span className="text-[#8ec0ff] text-sm">Featured Product (also show in homepage featured section)</span>
          </div>
          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              className="flex-1 bg-[#3390ff] hover:bg-[#2360b7] text-white py-3 px-4 rounded-md font-semibold text-lg shadow"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Product"}
            </button>
            <button
              type="button"
              className="flex-1 bg-[#22304a] hover:bg-[#2a3a5a] text-[#8ec0ff] py-3 px-4 rounded-md font-semibold text-lg shadow"
              onClick={() => router.push('/admin/products')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      {/* Cropper Modal */}
      <Modal
        isOpen={cropModalOpen}
        onRequestClose={() => setCropModalOpen(false)}
        contentLabel="Crop Image"
        ariaHideApp={false}
        style={{ content: { maxWidth: 400, margin: 'auto', height: 500 } }}
      >
        {cropImage && (
          <>
            <div style={{ position: 'relative', width: '100%', height: 350 }}>
              <ReactCrop
                crop={cropConfig}
                onChange={c => setCropConfig(c)}
                onComplete={c => setCompletedCrop(c)}
                keepSelection={true}
              >
                <img
                  src={cropImage}
                  alt="Crop"
                  ref={(el) => setCropImageRef(el)}
                  style={{ maxWidth: '100%', maxHeight: 350, display: 'block', margin: '0 auto' }}
                />
              </ReactCrop>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setCropModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
          <button
            onClick={() => setCropConfig({ unit: '%', x: 0, y: 0, width: 100, height: 100 })}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Fit to Image
          </button>
          <button onClick={handleCropComplete} className="px-4 py-2 bg-blue-600 text-white rounded">Crop & Select</button>
        </div>
      </Modal>

      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="bg-[#161e2e] border border-[#22304a] text-white sm:max-w-md">
          <DialogHeader className="items-center text-center sm:items-center sm:text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#22304a]">
              <CheckCircle2 className="h-8 w-8 text-[#3390ff]" />
            </div>
            <DialogTitle className="text-xl text-[#3390ff]">
              Product Added Successfully
            </DialogTitle>
            <DialogDescription className="text-[#8ec0ff]">
              {addedProductName
                ? `"${addedProductName}" has been added to your catalog.`
                : "Your product has been added to the catalog."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              className="w-full bg-[#3390ff] hover:bg-[#2360b7] text-white"
              onClick={() => {
                setSuccessModalOpen(false);
                router.push("/admin/products");
              }}
            >
              View Products
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#22304a] bg-[#22304a] text-[#8ec0ff] hover:bg-[#2a3a5a] hover:text-white"
              onClick={() => setSuccessModalOpen(false)}
            >
              Add Another Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 