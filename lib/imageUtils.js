// lib/imageUtils.js

/**
 * 이미지를 리사이즈하고 AVIF 형식으로 변환합니다.
 * @param {File} file - 처리할 이미지 파일
 * @param {number} maxSize - 긴 축의 최대 픽셀 크기
 * @returns {Promise<Blob>} AVIF 형식으로 변환된 Blob 객체
 */
export const processImageForUpload = (file, maxSize) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // AVIF 형식으로 변환 (품질 0.9)
        // 참고: AVIF 지원은 브라우저에 따라 다를 수 있습니다.
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed.'));
            }
          },
          'image/avif',
          0.9
        );
      };

      img.onerror = (error) => {
        reject(error);
      };
    };

    reader.onerror = (error) => {
      reject(error);
    };
  });
};
