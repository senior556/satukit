export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
}

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export async function resizeImage(
  file: File,
  options: { maxLongSide?: number; quality?: number } = {},
): Promise<ResizedImage> {
  const maxLongSide = options.maxLongSide ?? 1568;
  const quality = options.quality ?? 0.8;

  if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new RangeError("Выберите изображение JPEG, PNG, WebP, HEIC или HEIF.");
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    throw new RangeError("Размер изображения должен быть не больше 20 МБ.");
  }

  if (!Number.isFinite(maxLongSide) || maxLongSide <= 0) {
    throw new RangeError("Максимальная сторона изображения должна быть больше нуля.");
  }

  if (!Number.isFinite(quality) || quality <= 0 || quality > 1) {
    throw new RangeError("Качество JPEG должно быть числом от 0 до 1.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.type === "image/heic" || file.type === "image/heif") {
      throw new Error(
        "Этот браузер не смог открыть HEIC/HEIF. Сохраните фото как JPEG или PNG и попробуйте снова.",
      );
    }
    throw new Error("Не удалось открыть изображение. Выберите другой файл.");
  }

  try {
    const sourceLongSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxLongSide / sourceLongSide);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Браузер не поддерживает подготовку изображения.");
    }

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Не удалось подготовить изображение в формате JPEG."));
          }
        },
        "image/jpeg",
        quality,
      );
    });

    return {
      blob,
      width,
      height,
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    bitmap.close();
  }
}
