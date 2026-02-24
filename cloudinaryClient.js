const cloudinary = require("cloudinary").v2;

function getCloudinary() {
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  const hasParts =
    Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
    Boolean(process.env.CLOUDINARY_API_KEY) &&
    Boolean(process.env.CLOUDINARY_API_SECRET);

  if (!hasUrl && !hasParts) return null;

  if (hasParts) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  } else {
    // CLOUDINARY_URL is parsed automatically by the library; don't override with undefined parts.
    cloudinary.config({ secure: true });
  }

  return cloudinary;
}

module.exports = { getCloudinary };

