import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
} from '@react-email/components';
import React from 'react';

interface NewsletterConfirmEmailProps {
    confirmUrl: string;
    tenantName: string;
    logoUrl?: string;
    primaryColor?: string;
}

/**
 * Double opt-in confirmation (US-003). The ONLY action in this email is the
 * confirm link — nothing is marketing content, because the recipient has not
 * consented yet; this message is what asks for that consent.
 */
export const NewsletterConfirmEmail = ({
    confirmUrl = 'https://budstacks.io/api/storefront/newsletter/confirm?token=example',
    tenantName = 'BudStacks',
    logoUrl,
    primaryColor = '#10b981',
}: NewsletterConfirmEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Confirm your subscription to {tenantName}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        {logoUrl && (
                            <Section className="mt-[20px]">
                                <Img src={logoUrl} width="40" height="40" alt={tenantName} className="my-0 mx-auto" />
                            </Section>
                        )}
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Confirm your subscription
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Someone — hopefully you — asked to receive updates from <strong>{tenantName}</strong>.
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Click the button below to confirm. We won&apos;t send you anything until you do.
                        </Text>
                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                className="p-3 px-6 rounded text-white text-[14px] font-semibold no-underline text-center"
                                style={{ backgroundColor: primaryColor }}
                                href={confirmUrl}
                            >
                                Confirm Subscription
                            </Link>
                        </Section>
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            If you didn&apos;t ask for this, ignore this email — no subscription is created and you will not be contacted again.
                        </Text>
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            The {tenantName} Team
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default NewsletterConfirmEmail;
