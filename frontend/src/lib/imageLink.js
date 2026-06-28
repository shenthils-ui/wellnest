// Turn a pasted link into something we can show as an <img>. Google Drive
// "share" links point at a viewer page, not the image — convert them to the
// direct form. Anything else is returned unchanged.
export function toImageUrl(link) {
  if (!link) return null;
  const url = String(link).trim();
  // https://drive.google.com/file/d/FILEID/view?...  or  ...open?id=FILEID
  let m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  m = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  m = url.match(/[?&]id=([^&]+)/);
  if (m && /drive\.google\.com/.test(url)) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return url;
}

// Best-effort: does this link look like it points at an image we can render?
export function looksRenderable(link) {
  if (!link) return false;
  return /drive\.google\.com/.test(link) || /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|$)/i.test(link);
}
