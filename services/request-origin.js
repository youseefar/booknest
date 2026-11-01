function isOpaqueSameOriginNavigation(req) {
  return req.method !== 'OPTIONS'
    && req.get('Sec-Fetch-Site') === 'same-origin'
    && req.get('Sec-Fetch-Mode') === 'navigate'
    && req.get('Sec-Fetch-Dest') === 'document';
}

module.exports = { isOpaqueSameOriginNavigation };
