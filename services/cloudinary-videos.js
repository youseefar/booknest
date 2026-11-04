const crypto = require('node:crypto');
const CloudinaryVideoCleanup = require('../models/CloudinaryVideoCleanup');
const Property = require('../models/Property');

const VIDEO_LIMIT_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const VIDEO_FORMATS = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm'
};
const CLEANUP_BATCH_SIZE = 20;
let cleanupRunning = false;

function getCloudinaryCredentials(environment = process.env) {
    const cloudName = String(environment.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = String(environment.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = String(environment.CLOUDINARY_API_SECRET || '').trim();
    if (!cloudName || !apiKey || !apiSecret) {
        const error = new Error('Cloudinary video storage is not configured.');
        error.code = 'CLOUDINARY_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }
    return { cloudName, apiKey, apiSecret };
}

function isCloudinaryConfigured(environment = process.env) {
    return Boolean(
        String(environment.CLOUDINARY_CLOUD_NAME || '').trim()
        && String(environment.CLOUDINARY_API_KEY || '').trim()
        && String(environment.CLOUDINARY_API_SECRET || '').trim()
    );
}

function signParameters(parameters, apiSecret) {
    const signedParameters = Object.keys(parameters)
        .sort()
        .map(key => `${key}=${parameters[key]}`)
        .join('&');
    return crypto.createHash('sha1').update(`${signedParameters}${apiSecret}`).digest('hex');
}

async function validateVideoFile(file) {
    const mimetype = file?.mimetype || file?.type;
    const size = Buffer.isBuffer(file?.buffer) ? file.buffer.length : file?.size;
    if (!file || !Number.isSafeInteger(size) || size === 0
        || (!Buffer.isBuffer(file.buffer) && typeof file.slice !== 'function')) {
        const error = new Error('Choose a video file to upload.');
        error.status = 400;
        throw error;
    }
    if (size > VIDEO_LIMIT_BYTES) {
        const error = new Error('Video files must be 50 MB or smaller.');
        error.status = 413;
        throw error;
    }
    if (!ALLOWED_VIDEO_TYPES.has(mimetype)) {
        const error = new Error('Upload an MP4, MOV, or WebM video.');
        error.status = 415;
        throw error;
    }

    const header = Buffer.isBuffer(file.buffer)
        ? file.buffer.subarray(0, 12)
        : Buffer.from(await file.slice(0, 12).arrayBuffer());
    const isWebm = header.length >= 4
        && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const isIsoBaseMedia = header.length >= 12
        && header.toString('ascii', 4, 8) === 'ftyp';
    const typeMatchesSignature = mimetype === 'video/webm'
        ? isWebm
        : isIsoBaseMedia;
    if (!typeMatchesSignature) {
        const error = new Error('The selected file does not appear to be a supported video.');
        error.status = 415;
        throw error;
    }
}

async function uploadPropertyVideo(file) {
    await validateVideoFile(file);
    const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
    const folder = 'jacob-estate/properties';
    const publicId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const parameters = { folder, public_id: publicId, timestamp };
    const form = new FormData();
    form.set('api_key', apiKey);
    form.set('folder', folder);
    form.set('public_id', publicId);
    form.set('timestamp', String(timestamp));
    form.set('signature', signParameters(parameters, apiSecret));
    const mimetype = file.mimetype || file.type;
    const uploadFile = Buffer.isBuffer(file.buffer)
        ? new Blob([file.buffer], { type: mimetype })
        : file;
    form.set('file', uploadFile, `property-video.${getVideoExtension(mimetype)}`);

    return requestCloudinary(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/video/upload`, form, 'upload')
        .then(async result => {
            let secureUrl;
            try {
                secureUrl = new URL(result?.secure_url);
            } catch {
                if (result?.public_id) await cleanupOrQueueVideos([result.public_id]);
                throw new Error('Cloudinary returned an invalid video URL.');
            }
            if (secureUrl.protocol !== 'https:' || secureUrl.hostname !== 'res.cloudinary.com'
                || !result?.public_id) {
                if (result?.public_id) await cleanupOrQueueVideos([result.public_id]);
                throw new Error('Cloudinary returned invalid video metadata.');
            }
            return {
                videoUrl: secureUrl.toString(),
                videoPublicId: result.public_id,
                videoFormat: VIDEO_FORMATS[mimetype]
            };
        });
}

function getVideoExtension(mimetype) {
    if (mimetype === 'video/webm') return 'webm';
    if (mimetype === 'video/quicktime') return 'mov';
    return 'mp4';
}

async function requestCloudinary(endpoint, form, action) {
    const response = await fetch(endpoint, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(120000)
    });
    let result;
    try {
        result = await response.json();
    } catch (cause) {
        throw new Error(`Cloudinary returned an invalid ${action} response.`, { cause });
    }
    if (!response.ok || result?.error) {
        const error = new Error(`Cloudinary video ${action} failed.`);
        error.code = `CLOUDINARY_${action.toUpperCase()}_FAILED`;
        error.status = 502;
        throw error;
    }
    return result;
}

async function enqueueVideoCleanup(publicIds) {
    for (const publicId of new Set(publicIds.filter(value => typeof value === 'string' && value))) {
        await CloudinaryVideoCleanup.updateOne(
            { publicId },
            { $setOnInsert: { publicId, availableAt: new Date(Date.now() + 60 * 1000), attempts: 0 } },
            { upsert: true }
        );
    }
}

async function activateVideoCleanup(publicIds) {
    const uniqueIds = [...new Set(publicIds.filter(value => typeof value === 'string' && value))];
    if (!uniqueIds.length) return;
    await CloudinaryVideoCleanup.updateMany(
        { publicId: { $in: uniqueIds } },
        { $set: { availableAt: new Date() } }
    );
}

async function deleteCloudinaryVideo(publicId) {
    const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
    const timestamp = Math.floor(Date.now() / 1000);
    const parameters = { invalidate: true, public_id: publicId, timestamp };
    const form = new FormData();
    form.set('api_key', apiKey);
    form.set('invalidate', 'true');
    form.set('public_id', publicId);
    form.set('timestamp', String(timestamp));
    form.set('signature', signParameters(parameters, apiSecret));
    const result = await requestCloudinary(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/video/destroy`,
        form,
        'deletion'
    );
    if (!['ok', 'not found'].includes(result?.result)) {
        throw new Error('Cloudinary did not confirm video deletion.');
    }
}

async function cleanupOrQueueVideos(publicIds) {
    const uniqueIds = [...new Set(publicIds.filter(value => typeof value === 'string' && value))];
    if (!uniqueIds.length) return;
    await enqueueVideoCleanup(uniqueIds);
    await activateVideoCleanup(uniqueIds);
    await processVideoCleanupQueue();
}

async function processVideoCleanupQueue() {
    if (cleanupRunning || !isCloudinaryConfigured()) return;
    cleanupRunning = true;
    try {
        const jobs = await CloudinaryVideoCleanup.find({ availableAt: { $lte: new Date() } })
            .sort({ availableAt: 1 })
            .limit(CLEANUP_BATCH_SIZE);
        for (const job of jobs) {
            const stillReferenced = await Property.exists({ videoPublicId: job.publicId });
            if (stillReferenced) {
                await CloudinaryVideoCleanup.deleteOne({ _id: job._id });
                continue;
            }

            try {
                await deleteCloudinaryVideo(job.publicId);
                await CloudinaryVideoCleanup.deleteOne({ _id: job._id });
            } catch (error) {
                const attempts = job.attempts + 1;
                const retryDelay = Math.min(24 * 60 * 60 * 1000, 30000 * (2 ** Math.min(attempts, 10)));
                await CloudinaryVideoCleanup.updateOne(
                    { _id: job._id },
                    {
                        $set: {
                            attempts,
                            availableAt: new Date(Date.now() + retryDelay),
                            lastError: String(error.code || error.name || 'Cloudinary cleanup failed').slice(0, 120)
                        }
                    }
                );
                console.error('Cloudinary video cleanup retry scheduled:', {
                    publicId: job.publicId,
                    attempts,
                    name: error.name,
                    code: error.code
                });
            }
        }
    } finally {
        cleanupRunning = false;
    }
}

module.exports = {
    ALLOWED_VIDEO_TYPES,
    VIDEO_LIMIT_BYTES,
    VIDEO_FORMATS,
    cleanupOrQueueVideos,
    isCloudinaryConfigured,
    processVideoCleanupQueue,
    uploadPropertyVideo,
    validateVideoFile
};
