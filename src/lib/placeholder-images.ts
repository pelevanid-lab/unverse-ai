import data from '@/app/lib/placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

export const PlaceHolderImages: ImagePlaceholder[] = data.placeholderImages;

export function getPlaceholderById(id: string): ImagePlaceholder {
  return PlaceHolderImages.find(img => img.id === id) || PlaceHolderImages[0];
}
