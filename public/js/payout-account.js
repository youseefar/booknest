(() => {
    const form = document.getElementById('payout-account-form');
    if (!form) return;

    const bankSelect = document.getElementById('payout-bank');
    const accountInput = document.getElementById('payout-account-number');
    const verifyButton = document.getElementById('verify-payout-account');
    const saveButton = document.getElementById('save-payout-account');
    const verifiedNameInput = document.getElementById('verified-account-name');
    const status = document.getElementById('payout-account-status');
    let verifiedAccountName = '';
    let verificationRequestId = 0;
    let verificationTimer;
    let activeRequestController;

    const setStatus = (message, isError = false) => {
        status.textContent = message;
        status.classList.toggle('text-danger', isError);
        status.classList.toggle('text-success', !isError && Boolean(message));
    };

    const clearVerification = () => {
        window.clearTimeout(verificationTimer);
        activeRequestController?.abort();
        activeRequestController = null;
        verificationRequestId += 1;
        verifiedAccountName = '';
        verifiedNameInput.value = '';
        saveButton.disabled = true;
        verifyButton.disabled = !/^[0-9]{10}$/.test(accountInput.value.trim()) || !bankSelect.value;
        setStatus('');
    };

    const hasCompleteAccount = () => /^[0-9]{10}$/.test(accountInput.value.trim()) && Boolean(bankSelect.value);

    const verifyAccount = async () => {
        if (!form.reportValidity() || !hasCompleteAccount()) return;

        const requestId = ++verificationRequestId;
        const accountNumber = accountInput.value.trim();
        const bankCode = bankSelect.value;
        activeRequestController?.abort();
        activeRequestController = new AbortController();
        verifyButton.disabled = true;
        setStatus('Checking account name...');

        try {
            const response = await fetch('/payments/resolve-payout-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ bankCode, accountNumber }),
                signal: activeRequestController.signal
            });
            const result = await response.json();
            if (requestId !== verificationRequestId) return;
            if (!response.ok || !result.accountName) throw new Error(result.message || 'Could not verify this account.');

            verifiedAccountName = result.accountName;
            verifiedNameInput.value = verifiedAccountName;
            setStatus(`Account name: ${verifiedAccountName}. Confirm this is the correct account.`);
            saveButton.disabled = false;
        } catch (error) {
            if (requestId !== verificationRequestId || error.name === 'AbortError') return;
            verifiedAccountName = '';
            verifiedNameInput.value = '';
            saveButton.disabled = true;
            setStatus(error.message, true);
        } finally {
            if (requestId === verificationRequestId) {
                activeRequestController = null;
                verifyButton.disabled = !hasCompleteAccount();
            }
        }
    };

    const queueAccountVerification = () => {
        clearVerification();
        if (!hasCompleteAccount()) return;
        setStatus('Checking account name...');
        verifyButton.disabled = true;
        verificationTimer = window.setTimeout(verifyAccount, 450);
    };

    fetch('/payments/banks')
        .then(async response => {
            const result = await response.json();
            if (!response.ok || !Array.isArray(result.banks)) throw new Error(result.message || 'Unable to load banks.');
            return result.banks;
        })
        .then(banks => {
            bankSelect.replaceChildren(new Option('Choose your bank', ''));
            banks.forEach(bank => bankSelect.add(new Option(bank.name, bank.code)));
            bankSelect.disabled = false;
            bankSelect.value = form.dataset.selectedBank;
        })
        .catch(() => {
            bankSelect.replaceChildren(new Option('Banks are unavailable', ''));
            setStatus('Bank list is unavailable. Please refresh and try again.', true);
        });

    bankSelect.addEventListener('change', queueAccountVerification);
    accountInput.addEventListener('input', queueAccountVerification);
    verifyButton.addEventListener('click', () => {
        window.clearTimeout(verificationTimer);
        verifyAccount();
    });

    clearVerification();

    form.addEventListener('submit', event => {
        if (!verifiedAccountName || verifiedNameInput.value !== verifiedAccountName) {
            event.preventDefault();
            setStatus('Verify the account before saving it.', true);
        }
    });
})();