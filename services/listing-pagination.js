const PAGE_SIZE = 12;

const SORT_OPTIONS = {
    latest: { createdAt: -1, _id: -1 },
    price_asc: { price: 1, createdAt: -1, _id: -1 },
    price_desc: { price: -1, createdAt: -1, _id: -1 }
};

function parsePage(value) {
    const raw = String(value || '');
    if (!/^\d+$/.test(raw)) return 1;

    const page = Number(raw);
    return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function parseSort(value) {
    return Object.hasOwn(SORT_OPTIONS, value) ? value : 'latest';
}

function getPagination(page, totalCount) {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const currentPage = Math.min(page, Math.max(totalPages, 1));

    return {
        page: currentPage,
        pageSize: PAGE_SIZE,
        totalCount,
        totalPages,
        skip: (currentPage - 1) * PAGE_SIZE
    };
}

module.exports = { PAGE_SIZE, SORT_OPTIONS, getPagination, parsePage, parseSort };
