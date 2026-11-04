const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
    VIDEO_LIMIT_BYTES,
    isCloudinaryConfigured,
    uploadPropertyVideo,
    validateVideoFile
} = require('../services/cloudinary-videos');

const originalFetch = global.fetch;
const originalEnvironment = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
};

test.after(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

function mp4Buffer() {
    const data = Buffer.alloc(16);
    data.write('ftyp', 4, 'ascii');
    data.write('isom', 8, 'ascii');
    return data;
}

test('video validation accepts supported container signatures and rejects mismatches', async () => {
    await assert.doesNotReject(() => validateVideoFile({
        mimetype: 'video/mp4',
        buffer: mp4Buffer()
    }));
    await assert.doesNotReject(() => validateVideoFile({
        mimetype: 'video/webm',
        buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01])
    }));
    await assert.rejects(validateVideoFile({
        mimetype: 'image/png',
        buffer: mp4Buffer()
    }), { status: 415 });
    await assert.rejects(validateVideoFile({
        mimetype: 'video/mp4',
        buffer: Buffer.from('not a video')
    }), { status: 415 });
    await assert.rejects(validateVideoFile({
        mimetype: 'video/mp4',
        buffer: Buffer.alloc(VIDEO_LIMIT_BYTES + 1)
    }), { status: 413 });
    await assert.rejects(validateVideoFile(null), { status: 400 });
});

test('Cloudinary is enabled only when all server credentials are present', () => {
    assert.equal(isCloudinaryConfigured({
        CLOUDINARY_CLOUD_NAME: 'estate',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: ''
    }), false);
    assert.equal(isCloudinaryConfigured({
        CLOUDINARY_CLOUD_NAME: 'estate',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret'
    }), true);
});

test('video uploads use a server-signed Cloudinary request and accept only secure Cloudinary URLs', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'estate-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-api-key';
    process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
    let requestUrl;
    let requestBody;
    global.fetch = async (url, options) => {
        requestUrl = url;
        requestBody = options.body;
        return {
            ok: true,
            json: async () => ({
                secure_url: 'https://res.cloudinary.com/estate-cloud/video/upload/v1/test-video.mp4',
                public_id: 'jacob-estate/properties/test-video'
            })
        };
    };

    const uploaded = await uploadPropertyVideo({
        mimetype: 'video/mp4',
        buffer: mp4Buffer()
    });

    assert.equal(requestUrl, 'https://api.cloudinary.com/v1_1/estate-cloud/video/upload');
    assert.equal(uploaded.videoUrl, 'https://res.cloudinary.com/estate-cloud/video/upload/v1/test-video.mp4');
    assert.equal(uploaded.videoPublicId, 'jacob-estate/properties/test-video');
    assert.equal(uploaded.videoFormat, 'mp4');
    assert.equal(requestBody.get('api_key'), 'test-api-key');
    assert.equal(requestBody.get('file').type, 'video/mp4');
    assert.equal(requestUrl.includes(process.env.CLOUDINARY_API_SECRET), false);

    const parameters = {
        folder: requestBody.get('folder'),
        public_id: requestBody.get('public_id'),
        timestamp: Number(requestBody.get('timestamp'))
    };
    const canonical = Object.keys(parameters).sort().map(key => `${key}=${parameters[key]}`).join('&');
    const expectedSignature = crypto.createHash('sha1')
        .update(`${canonical}${process.env.CLOUDINARY_API_SECRET}`)
        .digest('hex');
    assert.equal(requestBody.get('signature'), expectedSignature);
});

test('video uploads reject a non-Cloudinary URL returned by the provider', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'estate-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-api-key';
    process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
    global.fetch = async () => ({
        ok: true,
        json: async () => ({
            secure_url: 'https://example.com/video.mp4'
        })
    });

    await assert.rejects(uploadPropertyVideo({
        mimetype: 'video/mp4',
        buffer: mp4Buffer()
    }), /invalid video metadata/i);
});

test('video uploads report network, invalid JSON, and Cloudinary API failures', async t => {
    process.env.CLOUDINARY_CLOUD_NAME = 'estate-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-api-key';
    process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
    const file = { mimetype: 'video/mp4', buffer: mp4Buffer() };

    await t.test('network failure', async () => {
        global.fetch = async () => {
            throw new TypeError('network unavailable');
        };
        await assert.rejects(uploadPropertyVideo(file), /network unavailable/i);
    });

    await t.test('non-JSON provider response', async () => {
        global.fetch = async () => ({
            ok: true,
            json: async () => {
                throw new SyntaxError('unexpected token');
            }
        });
        await assert.rejects(uploadPropertyVideo(file), /invalid upload response/i);
    });

    await t.test('provider API error', async () => {
        global.fetch = async () => ({
            ok: false,
            json: async () => ({ error: { message: 'invalid signature' } })
        });
        await assert.rejects(uploadPropertyVideo(file), error =>
            error.status === 502 && error.code === 'CLOUDINARY_UPLOAD_FAILED'
        );
    });
});
