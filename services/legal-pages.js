// Content for Jacob Estate's trust and policy pages. Edit wording here; routes and the
// shared template render every page from this list. No company registration numbers,
// addresses, licences or approvals are stated because none have been supplied.
const LAST_UPDATED = 'November 6, 2026';

const PAGES = [
    {
        slug: 'about',
        title: 'About Us',
        summary: 'What Jacob Estate is and how it works.',
        sections: [
            {
                heading: 'What Jacob Estate does',
                paragraphs: [
                    'Jacob Estate is an online marketplace where people in Nigeria can discover homes for rent and properties for sale, and where property owners can publish listings. Every listing is presented with a video tour so you can see a property before you travel to inspect it.'
                ]
            },
            {
                heading: 'Who uses it',
                items: [
                    'Home seekers browse verified listings, save favourites, book rentals and send sale inquiries.',
                    'Property owners add listings with video tours, manage availability and set up a payout account.',
                    'Administrators review listings before they are marked as verified.'
                ]
            },
            {
                heading: 'How we try to build trust',
                paragraphs: [
                    'New listings are reviewed before they are labelled verified, and a listing needs a video before it can be verified. A verified label reflects our listing review only. It is not a guarantee of ownership, title, condition or continued availability, so always inspect a property and confirm key details yourself.',
                    'Rental payments are made through Paystack, so you do not hand cash to a stranger. See the Payment and Payout Policy and the Safety and Fraud Prevention page for details.'
                ]
            }
        ]
    },
    {
        slug: 'contact',
        title: 'Contact Us',
        summary: 'How to reach Jacob Estate.',
        sections: [
            {
                heading: 'Questions about a listing',
                paragraphs: [
                    'For questions about a specific property, use the booking or inquiry options on that property page. They go to the property owner.'
                ]
            },
            {
                heading: 'Account, payment and platform questions',
                paragraphs: [
                    'Include your account email and, for payment issues, your Paystack payment reference. Never send your password, card number or one-time codes to anyone, including us.'
                ]
            },
            {
                heading: 'Reporting a problem',
                paragraphs: [
                    'To report a suspicious listing or user, contact us with the property link and a short description of what looks wrong. See Safety and Fraud Prevention for what to include.'
                ]
            }
        ]
    },
    {
        slug: 'faq',
        title: 'Frequently Asked Questions',
        summary: 'Quick answers about using Jacob Estate.',
        faqs: [
            ['Is it free to browse listings?', 'Yes. You can browse and watch listing videos without paying. You create a free account to book a rental, send a sale inquiry or save your account details.'],
            ['What does "verified" mean?', 'A verified listing has passed our listing review and has a video tour. It does not guarantee the property\'s condition, ownership or availability. Always inspect before you pay.'],
            ['How do rental payments work?', 'Rental payments go through Paystack\'s hosted checkout. For listings with a verified landlord payout account, 99% of the payment goes to the landlord\'s subaccount and 1% to the platform. Paystack transaction fees come out of the landlord\'s share.'],
            ['Can I buy a property through the app?', 'No. Jacob Estate does not process property purchase payments. Sale inquiries connect buyers and sellers so they can talk directly.'],
            ['Can I cancel a booking and get a refund?', 'You can cancel an active booking in the app, but cancelling does not automatically issue a refund. See the Refund and Cancellation Policy.'],
            ['Can I sign in with Google?', 'Yes, where Google sign-in is enabled. If you already have a password account with the same email, you confirm your password once before the two are linked.'],
            ['Why does a listing need a video?', 'Videos let renters and buyers see a property clearly and help us review listings. Videos can be MP4, MOV or WebM files up to 50 MB.'],
            ['How do I become a property owner on the platform?', 'Choose the property owner registration, add your listing with a video, and set up a payout account so you can receive rental payments.'],
            ['I think a listing is a scam. What should I do?', 'Do not pay anyone outside the app. Report the listing to us with its link. See Safety and Fraud Prevention.']
        ]
    },
    {
        slug: 'cookie-policy',
        title: 'Cookie Policy',
        summary: 'Cookies and browser storage used by the service.',
        sections: [
            {
                heading: 'What we use',
                items: [
                    'A session cookie keeps you signed in. It is needed for the service to work.',
                    'Short-lived data used to complete Google sign-in securely, when you choose that option.',
                    'Browser local storage on your device remembers your display theme, your saved homes list and whether you dismissed the install prompt.',
                    'The installable web app may keep a small offline copy of basic pages and icons so the app opens when you have no connection.'
                ]
            },
            {
                heading: 'Third parties',
                paragraphs: [
                    'Paystack\'s hosted checkout, Google sign-in and video delivery from Cloudinary are run by those providers and may set their own cookies under their own policies. We do not use advertising cookies at this time.'
                ]
            },
            {
                heading: 'Your choices',
                paragraphs: [
                    'You can clear cookies and site data in your browser settings at any time. If you block the session cookie you will not be able to stay signed in.'
                ]
            }
        ]
    },
    {
        slug: 'refund-policy',
        title: 'Refund and Cancellation Policy',
        summary: 'What happens when you cancel a booking or dispute a payment.',
        sections: [
            {
                heading: 'Cancelling a booking',
                paragraphs: [
                    'A renter can cancel an active booking in the app. Cancelling ends the booking in our records. It does not automatically refund a payment already made.'
                ]
            },
            {
                heading: 'Refund requests',
                paragraphs: [
                    'Rental payments are split at payment time, so the landlord\'s share is settled to the landlord\'s payout account. A refund of rent is therefore agreed between the renter and the property owner. Contact the owner first and keep your Paystack payment reference.',
                    'Jacob Estate does not promise refund amounts or timelines on behalf of owners or Paystack.'
                ]
            },
            {
                heading: 'Failed, duplicate or unrecognised charges',
                paragraphs: [
                    'If you were charged but your booking did not complete, or you were charged twice, contact us with your payment reference and the time of the payment. We can check our records, and Paystack can investigate the transaction itself.'
                ]
            },
            {
                heading: 'Sales',
                paragraphs: [
                    'Property sales are not paid through Jacob Estate, so this policy does not cover them.'
                ]
            }
        ]
    },
    {
        slug: 'payment-policy',
        title: 'Payment and Payout Policy',
        summary: 'How rental payments and landlord payouts work.',
        sections: [
            {
                heading: 'Paying for a rental',
                paragraphs: [
                    'Rental payments are processed by Paystack on its hosted checkout page. Jacob Estate does not see or store your card details. We store the payment reference, amount, status and dates needed to run your booking and produce your receipt.',
                    'A successful rental payment covers the monthly period shown in the booking flow. The amount is shown before you pay.'
                ]
            },
            {
                heading: 'How the money is split',
                paragraphs: [
                    'For listings whose owner has a verified payout account, Paystack routes 99% of the payment to the owner\'s subaccount and 1% to the platform. Paystack\'s transaction fees are charged to the owner\'s share.'
                ]
            },
            {
                heading: 'Landlord payout accounts',
                paragraphs: [
                    'Owners provide a bank and account number, which Paystack verifies and holds. We store the Paystack subaccount or recipient code, the account holder name, the bank name and the last four digits of the account only. A listing can accept payment only when the owner\'s payout account is ready.',
                    'Settlement timing is set by Paystack and the receiving bank, not by Jacob Estate.'
                ]
            },
            {
                heading: 'Verification',
                paragraphs: [
                    'We confirm each payment with Paystack on our server and through Paystack\'s signed notifications before marking a booking as paid. Never pay outside the app for a booking made here.'
                ]
            }
        ]
    },
    {
        slug: 'listing-guidelines',
        title: 'Property Listing Guidelines',
        summary: 'Rules for owners publishing listings.',
        sections: [
            {
                heading: 'Before you list',
                items: [
                    'You must have the right to rent or sell the property, or written authority from the owner.',
                    'Provide an accurate title, description, price, location, address and availability.',
                    'State bedrooms, bathrooms and amenities honestly.'
                ]
            },
            {
                heading: 'Video requirements',
                items: [
                    'Every listing needs one video tour of the actual property, in MP4, MOV or WebM format and no larger than 50 MB.',
                    'Do not use videos of other properties, stock footage or content you do not have the right to use.',
                    'You can replace or remove a video from the listing edit page. A listing cannot be verified without a video.'
                ]
            },
            {
                heading: 'What is not allowed',
                items: [
                    'Misleading prices, hidden fees, or listings for properties that are not available.',
                    'Asking renters or buyers to pay outside the platform to hold a booked property.',
                    'Personal data of other people, or sensitive personal details, in descriptions.',
                    'Unlawful, discriminatory or abusive content.'
                ]
            },
            {
                heading: 'Review and enforcement',
                paragraphs: [
                    'New listings start as pending until reviewed. We may reject, hide or remove listings that break these guidelines and may suspend accounts that repeat violations.'
                ]
            }
        ]
    },
    {
        slug: 'safety',
        title: 'Safety and Fraud Prevention',
        summary: 'How to protect yourself when renting or buying.',
        sections: [
            {
                heading: 'Before you pay',
                items: [
                    'Inspect the property in person, or send a trusted person, before paying or signing anything.',
                    'Compare what you see with the listing video and description.',
                    'Ask for proof that the person you are dealing with is the owner or authorised agent.',
                    'Be cautious of prices far below similar homes nearby.'
                ]
            },
            {
                heading: 'Paying safely',
                items: [
                    'Pay rent through the app\'s Paystack checkout so there is a payment record.',
                    'Do not send money by transfer to a person who asks you to pay "to hold" a property.',
                    'Never share your password, card PIN or one-time codes with anyone.'
                ]
            },
            {
                heading: 'Warning signs',
                items: [
                    'Pressure to pay immediately or in secret.',
                    'An owner who will not let you visit, or who is always "abroad".',
                    'Requests to move the conversation or payment away from Jacob Estate.'
                ]
            },
            {
                heading: 'Reporting',
                paragraphs: [
                    'If you suspect fraud, stop paying, keep your messages and receipts, and contact us with the property link and any payment reference. If you are in danger or have lost money, also report to the Nigeria Police Force or the relevant authority.'
                ]
            }
        ]
    },
    {
        slug: 'advertising-disclosure',
        title: 'Advertising Disclosure',
        summary: 'How paid placement and promotions are handled.',
        sections: [
            {
                heading: 'Current position',
                paragraphs: [
                    'Jacob Estate does not currently show third-party advertising. Our platform income comes from the 1% platform share of rental payments.'
                ]
            },
            {
                heading: 'If promotions are introduced',
                paragraphs: [
                    'Any featured, sponsored or advertised placement will be clearly labelled as such. Paying for promotion will not make a listing verified, and verification will remain a separate review.',
                    'Sponsored content will be updated on this page before it appears.'
                ]
            }
        ]
    },
    {
        slug: 'data-protection',
        title: 'Data Protection and User Rights',
        summary: 'Your rights over your personal data.',
        sections: [
            {
                heading: 'Our approach',
                paragraphs: [
                    'We handle personal data in line with applicable Nigerian data protection law, including the Nigeria Data Protection Act 2023. Our Privacy Policy explains what we collect and why.'
                ]
            },
            {
                heading: 'Your rights',
                items: [
                    'Access: ask what personal data we hold about you.',
                    'Correction: ask us to fix inaccurate or incomplete data. You can update many details on your profile page.',
                    'Deletion: ask us to delete data we no longer need, subject to records we must keep.',
                    'Objection and restriction: ask us to limit how we use your data in certain cases.',
                    'Portability: ask for your data in a usable format where it applies.',
                    'Withdraw consent: where we rely on your consent, you can withdraw it.'
                ]
            },
            {
                heading: 'Making a request',
                paragraphs: [
                    'Contact us through the Contact page. We may ask you to confirm your identity first so that your data is not given to someone else. Some payment and booking records may need to be kept for accounting and dispute purposes.'
                ]
            },
            {
                heading: 'Complaints',
                paragraphs: [
                    'If you are unhappy with how your data is handled, you may contact us first, and you also have the right to complain to the Nigeria Data Protection Commission.'
                ]
            }
        ]
    }
];

const PAGES_BY_SLUG = new Map(PAGES.map(page => [page.slug, page]));

module.exports = { LAST_UPDATED, PAGES, PAGES_BY_SLUG };
