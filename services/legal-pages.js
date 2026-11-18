// Content for Jacob Estate's trust and policy pages. Edit wording here; routes and the
// shared template render every page from this list. No company registration numbers,
// addresses, licences or approvals are stated because none have been supplied.
//
// Links inside text: write [words](/page) for a page on this site and
// [words](https://example.org/) for another website. See services/rich-text.js.
const LAST_UPDATED = 'November 15, 2026';

const PAGES = [
    {
        slug: 'about',
        title: 'About Us',
        summary: 'What Jacob Estate is and how it works.',
        sections: [
            {
                heading: 'What Jacob Estate does',
                paragraphs: [
                    `Jacob Estate is an online marketplace in [Nigeria](https://en.wikipedia.org/wiki/Nigeria) where people can discover [homes for rent](/properties?type=rent) and [properties for sale](/properties?type=sale), and where property owners can publish listings. Every listing is presented with a video tour, a short film of the actual property, so you can see it before you travel to inspect it.`,
                    `Finding a home usually means trusting photographs, phone calls and the word of someone you have never met. We built Jacob Estate around video because a [virtual tour](https://en.wikipedia.org/wiki/Virtual_tour) shows a place far more honestly than a few carefully chosen pictures. Property listings on Jacob Estate are video-only for that reason. If you are new here, the [frequently asked questions](/faq) are a good place to start.`
                ]
            },
            {
                heading: 'Who uses it',
                items: [
                    `Home seekers [browse listings](/properties), watch each video tour, keep favourites in their [saved homes](/saved-properties), book rentals and send sale inquiries. You can [create a free account](/register) in a minute.`,
                    `Property owners [sign up as owners](/register/landlord), add listings with video tours, manage availability and set up a [payout account](/payout-setup) so rent can reach them. The [listing guidelines](/listing-guidelines) explain what a good listing needs.`,
                    `Administrators review listings before they are marked as verified, and keep an audit record of what they change, as described in our [privacy policy](/privacy-policy).`
                ]
            },
            {
                heading: 'How we try to build trust',
                paragraphs: [
                    `New listings are reviewed before they are labelled verified, and a listing needs a video before it can be verified. A verified label reflects our listing review only. It is not a guarantee of ownership, title, condition or continued availability, so always inspect a property and confirm key details yourself. The [listing guidelines](/listing-guidelines) describe what we look for, and [Safety and Fraud Prevention](/safety) explains how to check the rest.`,
                    `Rental payments are made through [Paystack](https://paystack.com/), so you do not hand cash to a stranger and there is a payment record if something goes wrong. See the [Payment and Payout Policy](/payment-policy) for how the money is split and the [Refund and Cancellation Policy](/refund-policy) for what happens when plans change.`
                ]
            },
            {
                heading: 'How we earn money',
                paragraphs: [
                    `For rentals paid through the app, 99% of each payment goes to the property owner and 1% to Jacob Estate. We do not currently show third-party advertising; the [Advertising Disclosure](/advertising-disclosure) explains how any future promotion would be labelled so it can never be confused with a verified listing.`
                ]
            },
            {
                heading: 'Your information',
                paragraphs: [
                    `We collect only what we need to run the service and we explain it in the [Privacy Policy](/privacy-policy). Your rights over your data are set out on the [Data Protection and User Rights](/data-protection) page, and the [Cookie Policy](/cookie-policy) lists the small pieces of browser storage we use. By using Jacob Estate you agree to our [Terms of Service](/terms).`
                ]
            },
            {
                heading: 'Get in touch',
                paragraphs: [
                    `Questions, feedback or a problem to report? Visit the [Contact page](/contact). We welcome questions and feedback.`
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
                    `For questions about a specific property, use the booking or inquiry options on that property page. They go to the property owner, who knows the home best. You can find a home to ask about in [homes for rent](/properties?type=rent) or [properties for sale](/properties?type=sale), and follow your questions under [my inquiries](/my-inquiries) once you are signed in.`,
                    `If your question is about how booking or paying works rather than about one home, the [frequently asked questions](/faq) probably already answer it.`
                ]
            },
            {
                heading: 'Account, payment and platform questions',
                paragraphs: [
                    `Include your account email and, for payment issues, your [Paystack](https://paystack.com/) payment reference. You can see your bookings under [my bookings](/my-bookings). Never send your password, card number or one-time codes to anyone, including us.`,
                    `If you cannot sign in, try [resetting your password](/forgot-password) first. To change your details, open your [profile](/profile). For what happens to a payment that did not go through as expected, read the [Refund and Cancellation Policy](/refund-policy).`
                ]
            },
            {
                heading: 'Reporting a problem',
                paragraphs: [
                    `To report a suspicious listing or user, contact us with the property link and a short description of what looks wrong. [Safety and Fraud Prevention](/safety) explains what to include and what to do if you have already paid. Do not pay anyone outside the app for a home you found here.`
                ]
            },
            {
                heading: 'Privacy and data requests',
                paragraphs: [
                    `To ask what data we hold about you, to correct it, or to ask us to delete it, write to us using the email below and mention that it is a data request. The steps are explained on the [Data Protection and User Rights](/data-protection) page, and our [Privacy Policy](/privacy-policy) says what we collect.`
                ]
            },
            {
                heading: 'Property owners',
                paragraphs: [
                    `Owners with questions about listings, videos or payouts should read the [listing guidelines](/listing-guidelines) and the [Payment and Payout Policy](/payment-policy) first. If you have not registered yet, you can [sign up as a property owner](/register/landlord).`
                ]
            }
        ]
    },
    {
        slug: 'faq',
        title: 'Frequently Asked Questions',
        summary: 'Quick answers about using Jacob Estate.',
        faqs: [
            ['Is it free to browse listings?', `Yes. You can [browse all homes](/properties) and watch listing videos without paying. You create a free account to book a rental, send a sale inquiry or save your account details. You can [register here](/register).`],
            ['What does "verified" mean?', `A verified listing has passed our listing review and has a video tour. It does not guarantee the property's condition, ownership or availability. Always inspect before you pay. The review is described in the [listing guidelines](/listing-guidelines), and [Safety and Fraud Prevention](/safety) explains how to check a property yourself.`],
            ['How do rental payments work?', `Rental payments go through [Paystack](https://paystack.com/)'s hosted checkout. For listings with a verified landlord payout account, 99% of the payment goes to the landlord's subaccount and 1% to the platform. Paystack transaction fees come out of the landlord's share. The full explanation is in the [Payment and Payout Policy](/payment-policy).`],
            ['Can I buy a property through the app?', `No. Jacob Estate does not process property purchase payments. Sale inquiries connect buyers and sellers so they can talk directly. You can look through [properties for sale](/properties?type=sale), and our [safety advice](/safety) applies just as much to a purchase as to a rental.`],
            ['Can I cancel a booking and get a refund?', `You can cancel an active booking in the app under [my bookings](/my-bookings), but cancelling does not automatically issue a refund. See the [Refund and Cancellation Policy](/refund-policy) for what to do next.`],
            ['Can I sign in with Google?', `Yes, where Google sign-in is enabled. If you already have a password account with the same email, you confirm your password once before the two are linked. Google's own [privacy policy](https://policies.google.com/privacy) covers what Google does with your sign-in, and ours is the [Privacy Policy](/privacy-policy). You can also just [sign in](/login) with an email and password.`],
            ['Why does a listing need a video?', `Videos let renters and buyers see a property clearly and help us review listings. Videos can be [MP4](https://en.wikipedia.org/wiki/MPEG-4_Part_14), [MOV](https://en.wikipedia.org/wiki/QuickTime_File_Format) or [WebM](https://en.wikipedia.org/wiki/WebM) files up to 50 MB. Videos are hosted by [Cloudinary](https://cloudinary.com/). The [listing guidelines](/listing-guidelines) describe what a good video tour shows.`],
            ['How do I become a property owner on the platform?', `Choose the [property owner registration](/register/landlord), add your listing with a video, and set up a [payout account](/payout-setup) so you can receive rental payments. Read the [listing guidelines](/listing-guidelines) first so your listing is approved quickly.`],
            ['I think a listing is a scam. What should I do?', `Do not pay anyone outside the app. Report the listing to us through the [Contact page](/contact) with its link. See [Safety and Fraud Prevention](/safety) for warning signs and where to report fraud outside Jacob Estate.`],
            ['I forgot my password. What now?', `Use [forgot password](/forgot-password) and follow the email we send you. If you signed up with Google, use Google sign-in on the [sign-in page](/login) instead.`],
            ['What information do you keep about me?', `We keep what is needed to run your account, bookings and listings. The [Privacy Policy](/privacy-policy) lists it, the [Cookie Policy](/cookie-policy) covers browser storage, and the [Data Protection and User Rights](/data-protection) page explains how to ask for access, correction or deletion.`],
            ['Does Jacob Estate show ads?', `Not at the moment. If promotions are ever introduced they will be clearly labelled and will never make a listing verified. See the [Advertising Disclosure](/advertising-disclosure).`]
        ]
    },
    {
        slug: 'cookie-policy',
        title: 'Cookie Policy',
        summary: 'Cookies and browser storage used by the service.',
        sections: [
            {
                heading: 'What cookies and browser storage are',
                paragraphs: [
                    `A [cookie](https://en.wikipedia.org/wiki/HTTP_cookie) is a small piece of data that a website asks your browser to remember. Browsers can also keep data for a site in [web storage](https://en.wikipedia.org/wiki/Web_storage) on your own device. This page lists the cookies and storage Jacob Estate uses, why, and how you can control them. It sits alongside our [Privacy Policy](/privacy-policy) and our [Terms of Service](/terms).`
                ]
            },
            {
                heading: 'What we use',
                items: [
                    `A session cookie keeps you signed in. It is needed for the service to work, so there is no way to stay signed in without it.`,
                    `Short-lived data used to complete Google sign-in securely, when you choose that option. See the [sign-in page](/login).`,
                    `Browser local storage on your device remembers your display theme, a copy of your [saved homes](/saved-properties) list and whether you dismissed the install prompt. When you are signed in, the saved homes list is also kept on your account.`,
                    `The installable web app, a kind of [progressive web app](https://en.wikipedia.org/wiki/Progressive_web_app), may keep a small offline copy of basic pages and icons so the app opens when you have no connection.`
                ]
            },
            {
                heading: 'Third parties',
                paragraphs: [
                    `[Paystack](https://paystack.com/)'s hosted checkout, Google sign-in and video delivery from [Cloudinary](https://cloudinary.com/) are run by those providers and may set their own cookies under their own policies. Google explains its practices in its [privacy policy](https://policies.google.com/privacy). We do not use advertising cookies at this time, and the [Advertising Disclosure](/advertising-disclosure) explains how that would be announced if it changed.`
                ]
            },
            {
                heading: 'Your choices',
                paragraphs: [
                    `You can clear cookies and site data in your browser settings at any time. If you block the session cookie you will not be able to stay signed in, so you would have to [sign in](/login) again on every visit. Clearing local storage will also empty your saved homes list on that device.`,
                    `For questions about how your information is handled more broadly, see the [Data Protection and User Rights](/data-protection) page or [contact us](/contact).`
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
                    `A renter can cancel an active booking in the app from [my bookings](/my-bookings). Cancelling ends the booking in our records. It does not automatically refund a payment already made. Because a cancelled booking does not mean money comes back on its own, please read the next section before you cancel.`
                ]
            },
            {
                heading: 'Refund requests',
                paragraphs: [
                    `Rental payments are split at payment time, so the landlord's share is settled to the landlord's payout account, as explained in the [Payment and Payout Policy](/payment-policy). A refund of rent is therefore agreed between the renter and the property owner. Contact the owner first through [my inquiries](/my-inquiries) or the booking, and keep your [Paystack](https://paystack.com/) payment reference.`,
                    `Jacob Estate does not promise refund amounts or timelines on behalf of owners or Paystack.`
                ]
            },
            {
                heading: 'Failed, duplicate or unrecognised charges',
                paragraphs: [
                    `If you were charged but your booking did not complete, or you were charged twice, [contact us](/contact) with your payment reference and the time of the payment. We can check our records, and Paystack can investigate the transaction itself.`,
                    `If a payment is confirmed by Paystack but the home can no longer be secured for you (for example, someone else's payment was confirmed first), your booking is not marked as paid. We flag it for review so a refund or another solution can be arranged. Keep your payment reference and [contact us](/contact).`
                ]
            },
            {
                heading: 'If you cannot agree',
                paragraphs: [
                    `If you and an owner cannot agree, keep every message and receipt. You can ask us to look at our records through the [Contact page](/contact). If you believe you have been treated unfairly as a consumer, you can also learn about your rights from the [Federal Competition and Consumer Protection Commission](https://fccpc.gov.ng/). [Safety and Fraud Prevention](/safety) explains what to do if you think you have been defrauded.`
                ]
            },
            {
                heading: 'Sales',
                paragraphs: [
                    `Property sales are not paid through Jacob Estate, so this policy does not cover them. Sale inquiries only connect buyers and sellers; see the [Terms of Service](/terms) and the [frequently asked questions](/faq).`
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
                    `Rental payments are processed by [Paystack](https://paystack.com/) on its hosted checkout page. Jacob Estate does not see or store your card details. We store the payment reference, amount, status and dates needed to run your booking and produce your receipt, which you can find under [my bookings](/my-bookings).`,
                    `A successful rental payment covers the monthly period shown in the booking flow. The amount is shown before you pay. Always pay through the app and never by transfer to a person, as explained in [Safety and Fraud Prevention](/safety).`
                ]
            },
            {
                heading: 'How the money is split',
                paragraphs: [
                    `For listings whose owner has a verified payout account, Paystack routes 99% of the payment to the owner's subaccount and 1% to the platform. Paystack's transaction fees are charged to the owner's share. The 1% platform share is how Jacob Estate earns money, as described on the [About Us](/about) page and in the [Advertising Disclosure](/advertising-disclosure).`
                ]
            },
            {
                heading: 'Landlord payout accounts',
                paragraphs: [
                    `Owners provide a bank and account number on the [payout setup](/payout-setup) page, which Paystack verifies and holds. We store the Paystack subaccount or recipient code, the account holder name, the bank name and the last four digits of the account only, as set out in the [Privacy Policy](/privacy-policy). A listing can accept payment only when the owner's payout account is ready.`,
                    `Settlement timing is set by Paystack and the receiving bank, not by Jacob Estate.`
                ]
            },
            {
                heading: 'Verification',
                paragraphs: [
                    `We confirm each payment with Paystack on our server and through Paystack's signed notifications before marking a booking as paid. Never pay outside the app for a booking made here.`
                ]
            },
            {
                heading: 'When something goes wrong',
                paragraphs: [
                    `If a payment fails, is taken twice, or you do not recognise a charge, read the [Refund and Cancellation Policy](/refund-policy) and then [contact us](/contact) with your payment reference. Sales of property are not paid through Jacob Estate; see the [frequently asked questions](/faq).`
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
                    `You must have the right to rent or sell the property, or written authority from the owner. If you are unsure what a tenancy agreement should say, the general idea of a [lease](https://en.wikipedia.org/wiki/Lease) is a useful starting point, but get proper advice for your situation.`,
                    `Provide an accurate title, description, price, location, address and availability.`,
                    `State bedrooms, bathrooms and amenities honestly.`,
                    `You need an owner account to list. If you do not have one yet, [sign up as a property owner](/register/landlord).`
                ]
            },
            {
                heading: 'Video requirements',
                items: [
                    `Every listing needs one video tour of the actual property, in [MP4](https://en.wikipedia.org/wiki/MPEG-4_Part_14), [MOV](https://en.wikipedia.org/wiki/QuickTime_File_Format) or [WebM](https://en.wikipedia.org/wiki/WebM) format and no larger than 50 MB. Listings are video-only; we do not accept photo uploads.`,
                    `Walk through the whole property and show every room, the entrance, the compound or surroundings, and anything the description mentions. A good [virtual tour](https://en.wikipedia.org/wiki/Virtual_tour) answers a visitor's questions before they ask.`,
                    `Do not use videos of other properties, stock footage or content you do not have the right to use.`,
                    `You can replace or remove a video from the listing edit page. A listing cannot be verified without a video. Videos are stored with [Cloudinary](https://cloudinary.com/), as explained in the [Privacy Policy](/privacy-policy).`
                ]
            },
            {
                heading: 'Prices and payments',
                items: [
                    `Show the real price and every fee. Hidden fees are not allowed.`,
                    `To receive rent through the app you need a ready payout account; see [payout setup](/payout-setup) and the [Payment and Payout Policy](/payment-policy).`,
                    `Never ask a renter or buyer to pay you outside the platform to hold a property that was booked here.`
                ]
            },
            {
                heading: 'What is not allowed',
                items: [
                    `Misleading prices, hidden fees, or listings for properties that are not available.`,
                    `Asking renters or buyers to pay outside the platform to hold a booked property. This is one of the warning signs described in [Safety and Fraud Prevention](/safety).`,
                    `Personal data of other people, or sensitive personal details, in descriptions. See the [Privacy Policy](/privacy-policy) and [Data Protection and User Rights](/data-protection).`,
                    `Unlawful, discriminatory or abusive content, or anything that breaks the [Terms of Service](/terms).`
                ]
            },
            {
                heading: 'Review and enforcement',
                paragraphs: [
                    `New listings start as pending until reviewed. We may reject, hide or remove listings that break these guidelines and may suspend accounts that repeat violations. A listing that passes review is labelled verified, which reflects our review only and is not a guarantee of ownership, condition or availability. Paying for promotion can never make a listing verified; see the [Advertising Disclosure](/advertising-disclosure).`,
                    `Questions about a decision? [Contact us](/contact) and include the link to your listing.`
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
                heading: 'Why this matters',
                paragraphs: [
                    `Housing is one of the most common places for scams, because people are in a hurry and the amounts are large. Many follow the pattern of an [advance-fee scam](https://en.wikipedia.org/wiki/Advance-fee_scam): a "landlord" asks for money first and then disappears. Others use [phishing](https://en.wikipedia.org/wiki/Phishing), where a fake message tricks you into handing over a password or a code. This page explains how to protect yourself, whether you rent or buy through Jacob Estate or anywhere else.`
                ]
            },
            {
                heading: 'Before you pay',
                items: [
                    `Inspect the property in person, or send a trusted person, before paying or signing anything. The listing video helps you decide what is worth visiting, but it does not replace a visit.`,
                    `Compare what you see with the listing video and description.`,
                    `Ask for proof that the person you are dealing with is the owner or authorised agent. If someone says they represent a company, you can look for it on the [Corporate Affairs Commission](https://www.cac.gov.ng/) website. Jacob Estate's "verified" label is not proof of ownership; read the [listing guidelines](/listing-guidelines) to see what our review does and does not cover.`,
                    `Be cautious of prices far below similar homes nearby. Compare with other [homes for rent](/properties?type=rent) or [properties for sale](/properties?type=sale).`
                ]
            },
            {
                heading: 'Paying safely',
                items: [
                    `Pay rent through the app's [Paystack](https://paystack.com/) checkout so there is a payment record. How the money is split is explained in the [Payment and Payout Policy](/payment-policy).`,
                    `Do not send money by transfer to a person who asks you to pay "to hold" a property.`,
                    `Never share your password, card PIN or one-time codes with anyone, including anyone claiming to be from Jacob Estate. If you think your account has been exposed, [reset your password](/forgot-password) and update your [profile](/profile).`,
                    `For property purchases, which Jacob Estate does not process, get independent professional advice before you hand over any money.`
                ]
            },
            {
                heading: 'Warning signs',
                items: [
                    `Pressure to pay immediately or in secret.`,
                    `An owner who will not let you visit, or who is always "abroad".`,
                    `Requests to move the conversation or payment away from Jacob Estate.`,
                    `Messages with links asking you to sign in again. Always check the address in your browser, and [sign in](/login) from our own site.`
                ]
            },
            {
                heading: 'Reporting',
                paragraphs: [
                    `If you suspect fraud, stop paying, keep your messages and receipts, and [contact us](/contact) with the property link and any payment reference. If you are in danger or have lost money, also report to the [Nigeria Police Force](https://www.police.gov.ng/) or the relevant authority, such as the [Economic and Financial Crimes Commission](https://www.efcc.gov.ng/).`,
                    `If you paid through the app and something went wrong, read the [Refund and Cancellation Policy](/refund-policy). To learn about your rights as a consumer, see the [Federal Competition and Consumer Protection Commission](https://fccpc.gov.ng/).`
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
                    `Jacob Estate does not currently show third-party advertising. Our platform income comes from the 1% platform share of rental payments, explained in the [Payment and Payout Policy](/payment-policy) and on the [About Us](/about) page.`
                ]
            },
            {
                heading: 'If promotions are introduced',
                paragraphs: [
                    `Any featured, sponsored or advertised placement will be clearly labelled as such. Paying for promotion will not make a listing verified, and verification will remain a separate review as set out in the [listing guidelines](/listing-guidelines).`,
                    `Sponsored content will be updated on this page before it appears.`
                ]
            },
            {
                heading: 'Cookies and tracking',
                paragraphs: [
                    `We do not use advertising cookies at this time. If that changes, we will update the [Cookie Policy](/cookie-policy) and the [Privacy Policy](/privacy-policy) first, and you will be able to find out what is collected and why.`
                ]
            },
            {
                heading: 'Questions',
                paragraphs: [
                    `If you see something on Jacob Estate that looks like an advertisement but is not labelled, please [tell us](/contact). The general rules for the platform are in the [Terms of Service](/terms). To learn about your rights as a consumer in Nigeria, see the [Federal Competition and Consumer Protection Commission](https://fccpc.gov.ng/).`
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
                    `We handle personal data in line with applicable Nigerian data protection law, including the Nigeria Data Protection Act 2023, which is overseen by the [Nigeria Data Protection Commission](https://ndpc.gov.ng/). Our [Privacy Policy](/privacy-policy) explains what we collect and why, and the [Cookie Policy](/cookie-policy) covers browser storage. In short, [personal data](https://en.wikipedia.org/wiki/Personal_data) is information that identifies you, such as your name, email address or phone number.`
                ]
            },
            {
                heading: 'Your rights',
                items: [
                    `Access: ask what personal data we hold about you.`,
                    `Correction: ask us to fix inaccurate or incomplete data. You can update many details on your [profile](/profile) page.`,
                    `Deletion: ask us to delete data we no longer need, subject to records we must keep. Payment and booking records may need to be kept for accounting and dispute purposes, as described in the [Privacy Policy](/privacy-policy).`,
                    `Objection and restriction: ask us to limit how we use your data in certain cases.`,
                    `Portability: ask for your data in a usable format where it applies.`,
                    `Withdraw consent: where we rely on your consent, you can withdraw it.`
                ]
            },
            {
                heading: 'Who else handles your data',
                paragraphs: [
                    `Some of your information is handled by providers that help us run the service. [Paystack](https://paystack.com/) processes payments and holds payout bank details, and [Cloudinary](https://cloudinary.com/) hosts listing videos. If you choose Google sign-in, Google's [privacy policy](https://policies.google.com/privacy) applies to that sign-in. Each provider is responsible for its own handling under its own policies.`
                ]
            },
            {
                heading: 'Making a request',
                paragraphs: [
                    `[Contact us](/contact) and say which right you want to use. We may ask you to confirm your identity first so that your data is not given to someone else. Some payment and booking records may need to be kept for accounting and dispute purposes.`
                ]
            },
            {
                heading: 'Complaints',
                paragraphs: [
                    `If you are unhappy with how your data is handled, you may [contact us](/contact) first, and you also have the right to complain to the [Nigeria Data Protection Commission](https://ndpc.gov.ng/). Using Jacob Estate is also subject to our [Terms of Service](/terms).`
                ]
            }
        ]
    }
];

const PAGES_BY_SLUG = new Map(PAGES.map(page => [page.slug, page]));

module.exports = { LAST_UPDATED, PAGES, PAGES_BY_SLUG };
