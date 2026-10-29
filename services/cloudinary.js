const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

function uploadPropertyVideo(buffer) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({
            resource_type: 'video',
            folder: 'futb-housing/properties',
            allowed_formats: ['mp4', 'mov', 'webm']
        }, (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url) return reject(new Error('Cloudinary did not return a video URL.'));
            return resolve(result.secure_url);
        }).end(buffer);
    });
}

module.exports = { uploadPropertyVideo };
