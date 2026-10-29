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
            return resolve({
                videoUrl: cloudinary.url(result.public_id, {
                    resource_type: 'video',
                    secure: true,
                    transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1920, crop: 'limit' }]
                }),
                videoStreamUrl: cloudinary.url(`${result.public_id}.m3u8`, {
                    resource_type: 'video',
                    secure: true,
                    streaming_profile: 'auto:maxres_1080p'
                }),
                videoPosterUrl: cloudinary.url(result.public_id, {
                    resource_type: 'video',
                    format: 'jpg',
                    secure: true,
                    transformation: [{ width: 640, height: 360, crop: 'fill', quality: 'auto:eco' }]
                })
            });
        }).end(buffer);
    });
}

module.exports = { uploadPropertyVideo };
